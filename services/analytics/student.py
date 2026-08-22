"""Student progress, points, activity recording, metrics, comprehensive directory/dossier."""
import os
import json
import time
import base64 as _base64
from datetime import datetime

from .db import get_connection, set_system_setting, _strip_base64_from_quiz, _PROJECT_ROOT
from .quiz import get_journey_questions_from_db
from .videos import get_active_station_videos_db

_dir_cache = {'data': None, 'ts': 0, 'TTL': 30}


def get_student_by_id(student_id: str):
    """Retrieve student details and points if student_id was registered previously."""
    try:
        clean_id = str(student_id).strip()
        conn = get_connection()
        
        # Check quiz attempts first
        row = conn.execute(
            "SELECT student_name, score_percent FROM quiz_attempts WHERE student_id = ? ORDER BY id DESC LIMIT 1",
            (clean_id,)
        ).fetchone()

        # Check student progress table
        prog_row = conn.execute(
            "SELECT student_name, total_points, quiz_points, explore_points, campus_points FROM student_progress WHERE student_id = ?",
            (clean_id,)
        ).fetchone()

        stats = conn.execute(
            "SELECT COUNT(*) as total_attempts, MAX(score_percent) as max_score FROM quiz_attempts WHERE student_id = ?",
            (clean_id,)
        ).fetchone()

        conn.close()

        student_name = ""
        if row and row["student_name"]:
            student_name = row["student_name"]
        elif prog_row and prog_row["student_name"]:
            student_name = prog_row["student_name"]

        if not student_name:
            return None

        last_score = row["score_percent"] if (row and row["score_percent"] is not None) else 0
        total_attempts = stats["total_attempts"] if (stats and stats["total_attempts"]) else 0
        max_score = stats["max_score"] if (stats and stats["max_score"] is not None) else last_score
        total_points = prog_row["total_points"] if prog_row else 0
        quiz_points = prog_row["quiz_points"] if prog_row else 0

        return {
            "student_id": clean_id,
            "student_name": student_name,
            "last_score": last_score,
            "total_attempts": total_attempts,
            "max_score": max_score,
            "total_points": total_points,
            "quiz_points": quiz_points
        }
    except Exception as e:
        print(f"[Analytics] get_student_by_id error: {e}")
        return None
def save_student_progress_db(student_id, student_name=None, explore_points=0, quiz_points=0, campus_points=0, workshop_points=0, total_points=0, explored_docs=None, quiz_data=None, campus_data=None, workshops_data=None):
    """Save or update student unified progress and points in database with integrity checks."""
    if not student_id:
        return False
    clean_id = str(student_id).strip()
    if not clean_id or clean_id == 'guest_student' or len(clean_id) > 40:
        return False
    try:
        # Enforce strict point caps to prevent any tampering
        valid_explore = min(75.0, max(0.0, float(explore_points or 0)))
        valid_quiz = min(20.0, max(0.0, float(quiz_points or 0)))
        valid_campus = min(60.0, max(0.0, float(campus_points or 0)))
        valid_workshop = min(45.0, max(0.0, float(workshop_points or 0)))
        valid_total = min(200.0, max(0.0, float(total_points or (valid_explore + valid_quiz + valid_campus + valid_workshop))))

        conn = get_connection()
        c = conn.cursor()
        
        # Check existing row
        existing = c.execute("SELECT * FROM student_progress WHERE student_id = ?", (clean_id,)).fetchone()
        
        # ═══ POINT PROTECTION: Never let incoming zeros overwrite real points ═══
        if existing:
            ex_explore = float(existing['explore_points'] or 0)
            ex_quiz = float(existing['quiz_points'] or 0)
            ex_campus = float(existing['campus_points'] or 0)
            try:
                ex_workshop = float(existing['workshop_points'] or 0)
            except (IndexError, KeyError):
                ex_workshop = 0.0
            ex_total = float(existing['total_points'] or 0)
            
            # Keep the HIGHER value — points should only go UP, never DOWN
            valid_explore = max(valid_explore, ex_explore)
            valid_quiz = max(valid_quiz, ex_quiz)
            valid_campus = max(valid_campus, ex_campus)
            valid_workshop = max(valid_workshop, ex_workshop)
            
            # ═══ CRITICAL FIX: Recalculate total from final individual points ═══
            # total_points must always be the SUM of individual categories AFTER max()
            recalculated_total = min(200.0, valid_explore + valid_quiz + valid_campus + valid_workshop)
            valid_total = max(recalculated_total, ex_total)
        
        explored_json = explored_docs if isinstance(explored_docs, str) else json.dumps(explored_docs or {}, ensure_ascii=False)
        campus_json = campus_data if isinstance(campus_data, str) else json.dumps(campus_data or {}, ensure_ascii=False)
        workshops_json = workshops_data if isinstance(workshops_data, str) else json.dumps(workshops_data or {}, ensure_ascii=False)

        # ─── Strip base64 BEFORE saving to DB (keep DB lean) ─────────────────
        # Convert incoming quiz_data to dict first, then strip, then serialize
        if isinstance(quiz_data, str):
            try:
                _quiz_dict = json.loads(quiz_data)
            except Exception:
                _quiz_dict = {}
        else:
            _quiz_dict = quiz_data or {}
        if 'data:image' in json.dumps(_quiz_dict)[:200] or any(
            'data:image' in str(v)[:50] for v in [
                str(_quiz_dict.get('answered', '')),
                str(_quiz_dict.get('firstAttemptProofs', '')),
                str(_quiz_dict.get('firstAttemptAnswered', ''))
            ]
        ):
            _quiz_dict, _stripped = _strip_base64_from_quiz(_quiz_dict, clean_id)
            if _stripped:
                print(f"[Analytics] Stripped {_stripped} base64 images from {clean_id}")
        quiz_json = json.dumps(_quiz_dict, ensure_ascii=False)
        
        # ═══ PROTECT explored_docs and campus_data from empty overwrites ═══
        if existing:
            # Merge explored_docs: never lose read documents
            if existing['explored_docs_json'] and existing['explored_docs_json'] != '{}':
                try:
                    ex_docs = json.loads(existing['explored_docs_json'])
                    in_docs = json.loads(explored_json) if isinstance(explored_json, str) else (explored_docs or {})
                    if isinstance(ex_docs, dict) and isinstance(in_docs, dict):
                        merged_docs = {**ex_docs, **in_docs}  # incoming wins on conflict
                        if len(merged_docs) > len(in_docs):  # existing had extra docs
                            explored_json = json.dumps(merged_docs, ensure_ascii=False)
                except Exception:
                    pass
            
            # Merge campus_data: never lose booth visits
            if existing['campus_data_json'] and existing['campus_data_json'] != '{}':
                try:
                    ex_campus = json.loads(existing['campus_data_json'])
                    in_campus = json.loads(campus_json) if isinstance(campus_json, str) else (campus_data or {})
                    if isinstance(ex_campus, dict) and isinstance(in_campus, dict):
                        if not in_campus and ex_campus:
                            campus_json = existing['campus_data_json']
                        elif in_campus:
                            # Merge visited/scanned maps
                            merged_visited = {**(ex_campus.get('visited', {})), **(in_campus.get('visited', {}))}
                            merged_scanned = {**(ex_campus.get('scanned', {})), **(in_campus.get('scanned', {}))}
                            in_campus['visited'] = merged_visited
                            in_campus['scanned'] = merged_scanned
                            campus_json = json.dumps(in_campus, ensure_ascii=False)
                except Exception:
                    pass
        # ═══ CRITICAL: Smart merge quiz_data_json to NEVER lose firstAttempt/answered data ═══
        # When a student restarts the journey, answered={} gets synced. We must NOT overwrite
        # existing first-attempt data or complete answered data with empty data.
        if existing and existing['quiz_data_json']:
            try:
                existing_quiz = json.loads(existing['quiz_data_json'])
                incoming_quiz = json.loads(quiz_json) if isinstance(quiz_json, str) else (quiz_data or {})
                
                # Count real quiz answers (not proof images)
                def count_real_answers(ans_dict):
                    if not ans_dict or not isinstance(ans_dict, dict):
                        return 0
                    return sum(1 for v in ans_dict.values() if not (isinstance(v, dict) and v.get('fileName')))
                
                # --- Preserve firstAttempt ---
                ex_first = existing_quiz.get('firstAttempt') or {}
                in_first = incoming_quiz.get('firstAttempt') or {}
                ex_first_real = count_real_answers(ex_first.get('answered', {}))
                in_first_real = count_real_answers(in_first.get('answered', {}))
                
                # Keep existing firstAttempt if it has more real answers
                if ex_first_real > in_first_real:
                    incoming_quiz['firstAttempt'] = ex_first
                # If incoming has no firstAttempt at all but existing does, keep existing
                elif not in_first and ex_first:
                    incoming_quiz['firstAttempt'] = ex_first
                
                # --- Preserve top-level firstAttemptAnswered (legacy key) ---
                ex_fa_top = existing_quiz.get('firstAttemptAnswered') or {}
                in_fa_top = incoming_quiz.get('firstAttemptAnswered') or {}
                if count_real_answers(ex_fa_top) > count_real_answers(in_fa_top):
                    incoming_quiz['firstAttemptAnswered'] = ex_fa_top
                
                # --- Preserve answered (never replace full answers with empty) ---
                if count_real_answers(incoming_quiz.get('answered', {})) == 0 and count_real_answers(existing_quiz.get('answered', {})) > 0:
                    incoming_quiz['answered'] = existing_quiz['answered']
                
                # --- Preserve firstAttemptSaved flag ---
                if existing_quiz.get('firstAttemptSaved') and not incoming_quiz.get('firstAttemptSaved'):
                    incoming_quiz['firstAttemptSaved'] = True
                
                # --- Preserve firstAttemptScore/Time ---
                if ex_first.get('score') and not in_first.get('score'):
                    if 'firstAttempt' not in incoming_quiz:
                        incoming_quiz['firstAttempt'] = {}
                    incoming_quiz['firstAttempt']['score'] = ex_first['score']
                    incoming_quiz['firstAttempt']['time'] = ex_first.get('time', 0)
                
                # --- Merge attemptsHistory (never lose attempt records) ---
                existing_history = existing_quiz.get('attemptsHistory', [])
                incoming_history = incoming_quiz.get('attemptsHistory', [])
                if len(existing_history) > len(incoming_history):
                    incoming_quiz['attemptsHistory'] = existing_history
                
                # --- Preserve proofs (IMMUTABLE once set) ---
                ex_first_proofs = existing_quiz.get('firstAttemptProofs') or {}
                in_first_proofs = incoming_quiz.get('firstAttemptProofs') or {}
                
                # If existing firstAttemptProofs has real data, ALWAYS keep it (immutable)
                has_existing_proofs = (
                    ex_first_proofs.get('email') or ex_first_proofs.get('blackboard')
                )
                if has_existing_proofs:
                    # Lock first attempt proofs — never overwrite
                    incoming_quiz['firstAttemptProofs'] = ex_first_proofs
                    # If incoming has different proofs, store them as latestProofs
                    if in_first_proofs and in_first_proofs != ex_first_proofs:
                        incoming_quiz['latestProofs'] = in_first_proofs
                elif in_first_proofs:
                    # First time setting proofs — let incoming through
                    pass
                elif ex_first_proofs:
                    incoming_quiz['firstAttemptProofs'] = ex_first_proofs
                
                # Preserve general proofs (legacy key)
                if existing_quiz.get('proofs') and not incoming_quiz.get('proofs'):
                    incoming_quiz['proofs'] = existing_quiz['proofs']
                
                # Preserve latestProofs if incoming doesn't have them
                if existing_quiz.get('latestProofs') and not incoming_quiz.get('latestProofs'):
                    incoming_quiz['latestProofs'] = existing_quiz['latestProofs']
                
                quiz_json = json.dumps(incoming_quiz, ensure_ascii=False)
            except Exception as merge_err:
                print(f"[Analytics] quiz_data merge warning: {merge_err}")
                # On merge error, keep the original quiz_json as-is
        
        if existing:
            final_name = student_name or existing['student_name'] or f"طالب {clean_id}"
            c.execute("""
                UPDATE student_progress
                SET student_name = ?,
                    explore_points = ?,
                    quiz_points = ?,
                    campus_points = ?,
                    workshop_points = ?,
                    total_points = ?,
                    explored_docs_json = ?,
                    quiz_data_json = ?,
                    campus_data_json = ?,
                    workshops_data_json = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE student_id = ?
            """, (final_name, valid_explore, valid_quiz, valid_campus, valid_workshop, valid_total, explored_json, quiz_json, campus_json, workshops_json, clean_id))
        else:
            final_name = student_name or f"طالب {clean_id}"
            c.execute("""
                INSERT INTO student_progress
                (student_id, student_name, explore_points, quiz_points, campus_points, workshop_points, total_points, explored_docs_json, quiz_data_json, campus_data_json, workshops_data_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """, (clean_id, final_name, valid_explore, valid_quiz, valid_campus, valid_workshop, valid_total, explored_json, quiz_json, campus_json, workshops_json))
            
        conn.commit()
        conn.close()
        _dir_cache['data'] = None  # Invalidate directory cache on any save
        return True
    except Exception as e:
        print(f"[Analytics] save_student_progress_db error: {e}")
        return False


def get_student_progress_db(student_id):
    """Retrieve full student progress and points from database."""
    if not student_id:
        return None
    clean_id = str(student_id).strip()
    try:
        conn = get_connection()
        row = conn.execute("SELECT * FROM student_progress WHERE student_id = ?", (clean_id,)).fetchone()
        conn.close()
        if not row:
            return None
        
        return {
            'student_id': row['student_id'],
            'student_name': row['student_name'],
            'explore_points': float(row['explore_points'] or 0),
            'quiz_points': float(row['quiz_points'] or 0),
            'campus_points': float(row['campus_points'] or 0),
            'workshop_points': float(row['workshop_points'] or 0) if 'workshop_points' in row.keys() else 0.0,
            'total_points': float(row['total_points'] or 0),
            'explored_docs': json.loads(row['explored_docs_json'] or '{}'),
            'quiz_data': json.loads(row['quiz_data_json'] or '{}'),
            'campus_data': json.loads(row['campus_data_json'] or '{}'),
            'workshops_data': json.loads(row['workshops_data_json'] or '{}') if 'workshops_data_json' in row.keys() else {},
            'created_at': row['created_at'],
            'updated_at': row['updated_at']
        }
    except Exception as e:
        print(f"[Analytics] get_student_progress_db error: {e}")
        return None


def get_all_students_progress_db(limit=50):
    """Retrieve all student progress records ordered by total points descending."""
    try:
        conn = get_connection()
        rows = conn.execute("""
            SELECT * FROM student_progress
            ORDER BY total_points DESC, updated_at DESC
            LIMIT ?
        """, (limit,)).fetchall()
        conn.close()
        
        results = []
        for row in rows:
            results.append({
                'student_id': row['student_id'],
                'student_name': row['student_name'],
                'explore_points': float(row['explore_points'] or 0),
                'quiz_points': float(row['quiz_points'] or 0),
                'campus_points': float(row['campus_points'] or 0),
                'workshop_points': float(row['workshop_points'] or 0) if 'workshop_points' in row.keys() else 0.0,
                'total_points': float(row['total_points'] or 0),
                'explored_docs': json.loads(row['explored_docs_json'] or '{}'),
                'quiz_data': json.loads(row['quiz_data_json'] or '{}'),
                'campus_data': json.loads(row['campus_data_json'] or '{}'),
                'created_at': row['created_at'],
                'updated_at': row['updated_at']
            })
        return results
    except Exception as e:
        print(f"[Analytics] get_all_students_progress_db error: {e}")
        return []
def ensure_student_exists(conn, student_id, student_name=None):
    """Helper to ensure a student_progress record exists.
    Uses INSERT OR IGNORE — safe for concurrent access (student_id is PRIMARY KEY).
    """
    name = student_name or f"طالب {student_id}"
    conn.execute("""
        INSERT OR IGNORE INTO student_progress (student_id, student_name, created_at, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    """, (student_id, name))


def record_student_activity_db(student_id, activity_type, item_id, item_title="", points_earned=0.0, metadata=None):
    """Log an activity event for a student atomically and update total points."""
    if not student_id or student_id == 'guest_student':
        return False
    clean_id = str(student_id).strip()
    meta_json = json.dumps(metadata or {}, ensure_ascii=False)
    pts = float(points_earned or 0)

    try:
        conn = get_connection()
        ensure_student_exists(conn, clean_id)
        conn.execute("""
            INSERT INTO student_activities (student_id, activity_type, item_id, item_title, points_earned, metadata_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (clean_id, activity_type, str(item_id), item_title, pts, meta_json))

        conn.execute("""
            UPDATE student_progress
            SET total_points = total_points + ?, updated_at = CURRENT_TIMESTAMP
            WHERE student_id = ?
        """, (pts, clean_id))

        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"[Analytics] record_student_activity_db error: {e}")
        return False


def record_qr_scan_db(student_id, booth_code, booth_name="", points=10.0):
    """Record a QR code scan by a student (one-time per booth).
    Uses INSERT OR IGNORE for atomic duplicate protection — safe for 6000+ concurrent users.
    """
    if not student_id or student_id == 'guest_student':
        return {'success': False, 'message': 'الرقم الجامعي مطلوب'}
    clean_id = str(student_id).strip()
    clean_code = str(booth_code).strip()

    try:
        conn = get_connection()
        ensure_student_exists(conn, clean_id)

        # Atomic: INSERT OR IGNORE relies on UNIQUE(student_id, booth_code) constraint
        # If duplicate, rows_affected = 0 — no race condition possible
        cur = conn.execute("""
            INSERT OR IGNORE INTO student_qr_scans (student_id, booth_code, booth_name, points_earned, scanned_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (clean_id, clean_code, booth_name, float(points)))

        if cur.rowcount == 0:
            # Already scanned — UNIQUE constraint blocked the insert
            conn.close()
            return {'success': True, 'already_scanned': True, 'points_awarded': 0, 'message': 'تم مسح هذا الباركود سابقاً'}

        # First-time scan — update student_progress points
        conn.execute("""
            UPDATE student_progress
            SET campus_points = campus_points + ?,
                total_points = total_points + ?,
                qr_scans_count = qr_scans_count + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE student_id = ?
        """, (float(points), float(points), clean_id))

        # Also log in activities
        conn.execute("""
            INSERT INTO student_activities (student_id, activity_type, item_id, item_title, points_earned, created_at)
            VALUES (?, 'qr_scan', ?, ?, ?, CURRENT_TIMESTAMP)
        """, (clean_id, clean_code, f"مسح باركود: {booth_name or clean_code}", float(points)))

        conn.commit()
        conn.close()
        return {'success': True, 'already_scanned': False, 'points_awarded': float(points), 'message': f'تم احتساب {points} نقطة بنجاح!'}
    except Exception as e:
        print(f"[Analytics] record_qr_scan_db error: {e}")
        return {'success': False, 'error': str(e)}


def record_workshop_attendance_db(student_id, workshop_id, workshop_title="", day_number=1, points=15.0):
    """Record workshop attendance for a student (one-time per workshop).
    Uses INSERT OR IGNORE for atomic duplicate protection — safe for 6000+ concurrent users.
    """
    if not student_id or student_id == 'guest_student':
        return {'success': False, 'message': 'الرقم الجامعي مطلوب'}
    clean_id = str(student_id).strip()
    clean_ws = str(workshop_id).strip()

    try:
        conn = get_connection()
        ensure_student_exists(conn, clean_id)

        # Atomic: INSERT OR IGNORE relies on UNIQUE(student_id, workshop_id) constraint
        cur = conn.execute("""
            INSERT OR IGNORE INTO student_workshop_attendance (student_id, workshop_id, workshop_title, day_number, points_earned, attended_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (clean_id, clean_ws, workshop_title, int(day_number), float(points)))

        if cur.rowcount == 0:
            conn.close()
            return {'success': True, 'already_attended': True, 'points_awarded': 0, 'message': 'تم تسجيل حضور هذه الورشة مسبقاً'}

        # First-time attendance — update student_progress
        conn.execute("""
            UPDATE student_progress
            SET workshop_points = workshop_points + ?,
                total_points = total_points + ?,
                workshops_completed_count = workshops_completed_count + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE student_id = ?
        """, (float(points), float(points), clean_id))

        # Also log in activities
        conn.execute("""
            INSERT INTO student_activities (student_id, activity_type, item_id, item_title, points_earned, created_at)
            VALUES (?, 'workshop_attendance', ?, ?, ?, CURRENT_TIMESTAMP)
        """, (clean_id, clean_ws, f"حضور ورشة: {workshop_title or clean_ws}", float(points)))

        conn.commit()
        conn.close()
        return {'success': True, 'already_attended': False, 'points_awarded': float(points), 'message': f'تم تأكيد حضور الورشة واحتساب {points} نقطة!'}
    except Exception as e:
        print(f"[Analytics] record_workshop_attendance_db error: {e}")
        return {'success': False, 'error': str(e)}


def record_survey_response_db(student_id, student_name, satisfaction, organization, workshops, navigation, positive, suggestions, points=10.0):
    """Save student feedback survey response and award survey points."""
    if not student_id:
        return {'success': False, 'message': 'الرقم الجامعي مطلوب'}
    clean_id = str(student_id).strip()

    try:
        conn = get_connection()
        # Check if student already submitted survey
        existing = conn.execute("SELECT id FROM survey_responses WHERE student_id = ?", (clean_id,)).fetchone()
        if existing:
            conn.close()
            return {'success': True, 'already_submitted': True, 'points_awarded': 0, 'message': 'تم استلام استبيانك مسبقاً، شكراً لمشاركتك!'}

        ensure_student_exists(conn, clean_id, student_name)

        conn.execute("""
            INSERT INTO survey_responses (
                student_id, student_name, satisfaction_rating, organization_rating,
                workshops_rating, easy_navigation_rating, positive_feedback, suggestions,
                points_awarded, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (
            clean_id, student_name or f"طالب {clean_id}",
            int(satisfaction or 5), int(organization or 5),
            int(workshops or 5), int(navigation or 5),
            str(positive or ''), str(suggestions or ''), float(points)
        ))

        # Award points in student_progress
        conn.execute("""
            UPDATE student_progress
            SET total_points = total_points + ?, updated_at = CURRENT_TIMESTAMP
            WHERE student_id = ?
        """, (float(points), clean_id))

        # Also log in activities
        conn.execute("""
            INSERT INTO student_activities (student_id, activity_type, item_id, item_title, points_earned, created_at)
            VALUES (?, 'survey_submission', 'survey_rowad', 'استبيان تقييم برنامج الاستقبال', ?, CURRENT_TIMESTAMP)
        """, (clean_id, float(points)))

        conn.commit()
        conn.close()
        return {'success': True, 'already_submitted': False, 'points_awarded': float(points), 'message': 'شكراً لمشاركتك القيّمة! تم احتساب نقاط التقييم بنجاح'}
    except Exception as e:
        print(f"[Analytics] record_survey_response_db error: {e}")
        return {'success': False, 'error': str(e)}


def get_student_detailed_metrics_db(student_id):
    """Retrieve full adaptive breakdown metrics for a student."""
    if not student_id:
        return None
    clean_id = str(student_id).strip()

    try:
        conn = get_connection()
        prog = conn.execute("SELECT * FROM student_progress WHERE student_id = ?", (clean_id,)).fetchone()
        qr_scans = conn.execute("SELECT booth_code, booth_name, points_earned, scanned_at FROM student_qr_scans WHERE student_id = ?", (clean_id,)).fetchall()
        workshops = conn.execute("SELECT workshop_id, workshop_title, day_number, points_earned, attended_at FROM student_workshop_attendance WHERE student_id = ?", (clean_id,)).fetchall()
        quiz_attempts = conn.execute("SELECT score_percent, correct_answers, total_questions, time_taken_seconds, created_at FROM quiz_attempts WHERE student_id = ? ORDER BY created_at DESC", (clean_id,)).fetchall()
        survey = conn.execute("SELECT * FROM survey_responses WHERE student_id = ?", (clean_id,)).fetchone()
        activities = conn.execute("SELECT activity_type, item_id, item_title, points_earned, created_at FROM student_activities WHERE student_id = ? ORDER BY created_at DESC LIMIT 20", (clean_id,)).fetchall()
        conn.close()

        total_pts = float(prog['total_points'] or 0) if prog else 0.0

        return {
            'student_id': clean_id,
            'student_name': prog['student_name'] if prog else f"طالب {clean_id}",
            'total_points': total_pts,
            'explore_points': float(prog['explore_points'] or 0) if prog else 0.0,
            'quiz_points': float(prog['quiz_points'] or 0) if prog else 0.0,
            'campus_points': float(prog['campus_points'] or 0) if prog else 0.0,
            'workshop_points': float(prog['workshop_points'] or 0) if prog else 0.0,
            'stations_completed': int(prog['stations_completed_count'] or 0) if prog else 0,
            'qr_scans': [dict(q) for q in qr_scans],
            'qr_scans_count': len(qr_scans),
            'workshops': [dict(w) for w in workshops],
            'workshops_count': len(workshops),
            'quiz_attempts_count': len(quiz_attempts),
            'latest_quiz_score': float(quiz_attempts[0]['score_percent']) if quiz_attempts else 0.0,
            'survey_completed': bool(survey),
            'recent_activities': [dict(a) for a in activities]
        }
    except Exception as e:
        print(f"[Analytics] get_student_detailed_metrics_db error: {e}")
        return None
def reset_student_progress_db(student_id):
    """Zero out points and wipe progress for a specific student across all tables."""
    if not student_id:
        return False
    clean_id = str(student_id).strip()
    try:
        conn = get_connection()
        # Reset progress row
        conn.execute("""
            UPDATE student_progress
            SET explore_points = 0, quiz_points = 0, campus_points = 0, workshop_points = 0, total_points = 0,
                stations_completed_count = 0, qr_scans_count = 0, quiz_answers_count = 0, workshops_completed_count = 0, docs_explored_count = 0,
                explored_docs_json = '{}', quiz_data_json = '{}', campus_data_json = '{}', workshops_data_json = '{}',
                updated_at = CURRENT_TIMESTAMP
            WHERE student_id = ?
        """, (clean_id,))
        conn.execute("DELETE FROM quiz_attempts WHERE student_id = ?", (clean_id,))
        conn.execute("DELETE FROM student_activities WHERE student_id = ?", (clean_id,))
        conn.execute("DELETE FROM student_qr_scans WHERE student_id = ?", (clean_id,))
        conn.execute("DELETE FROM student_workshop_attendance WHERE student_id = ?", (clean_id,))
        conn.execute("DELETE FROM survey_responses WHERE student_id = ?", (clean_id,))
        conn.commit()
        conn.close()
        print(f"[Analytics] Student {clean_id} fully reset across all relational tables.")
        return True
    except Exception as e:
        print(f"[Analytics] reset_student_progress_db error: {e}")
        return False


def clear_all_student_activity_data():
    """Wipe all student test data, progress, attempts, activities, and logs safely."""
    try:
        conn = get_connection()
        conn.execute("DELETE FROM student_progress;")
        conn.execute("DELETE FROM quiz_attempts;")
        conn.execute("DELETE FROM student_activities;")
        conn.execute("DELETE FROM student_qr_scans;")
        conn.execute("DELETE FROM student_workshop_attendance;")
        conn.execute("DELETE FROM survey_responses;")
        conn.execute("DELETE FROM visits;")
        conn.execute("DELETE FROM question_logs;")
        conn.execute("DELETE FROM source_hits;")
        conn.execute("DELETE FROM source_clicks;")
        conn.execute("DELETE FROM ui_events;")
        conn.commit()
        conn.close()
        set_system_setting('global_reset_epoch', datetime.utcnow().isoformat())
        print("[Analytics] All student activity, relational tables, and points wiped successfully.")
        return True
    except Exception as e:
        print(f"[Analytics] Error clearing database: {e}")
        return False


# ─── Master Interactive Journey Questions Configuration ───────────────────
_journey_questions_cache = {'data': None, 'ts': 0}

def _get_journey_questions_config():
    """Get journey questions config from DB with 60-second cache."""
    import time
    now = time.time()
    if _journey_questions_cache['data'] is not None and (now - _journey_questions_cache['ts']) < 60:
        return _journey_questions_cache['data']
    data = get_journey_questions_from_db()
    _journey_questions_cache['data'] = data
    _journey_questions_cache['ts'] = now
    return data


def build_journey_answers_detail(answered_dict):
    """Reconstruct complete 13 questions detailed breakdown from student answers."""
    if not isinstance(answered_dict, dict):
        return []
    detail = []
    for q in _get_journey_questions_config():
        slide_num = q["slide"]
        user_val = answered_dict.get(slide_num)
        if user_val is None:
            user_val = answered_dict.get(str(slide_num))
            
        if user_val is not None and isinstance(user_val, (int, float, str)) and str(user_val).isdigit():
            user_idx = int(user_val)
            corr_idx = q["correct_option_idx"]
            is_corr = (user_idx == corr_idx)
            
            selected_letter = q["options_letters"][user_idx] if 0 <= user_idx < len(q["options_letters"]) else str(user_idx)
            selected_text = q["options"][user_idx] if 0 <= user_idx < len(q["options"]) else str(user_idx)
            corr_letter = q["options_letters"][corr_idx] if 0 <= corr_idx < len(q["options_letters"]) else str(corr_idx)
            corr_text = q["options"][corr_idx] if 0 <= corr_idx < len(q["options"]) else str(corr_idx)
            
            detail.append({
                "slide": slide_num,
                "station": q["station"],
                "question": q["question"],
                "selected_option": selected_letter,
                "selected_text": selected_text,
                "correct_option": corr_letter,
                "correct_text": corr_text,
                "is_correct": is_corr,
                "explanation": q["explanation"],
                "article_ref": q["article_ref"]
            })
    return detail


def get_all_students_comprehensive_directory_db(sort_by='smart'):
    """
    Retrieve all students with comprehensive performance metrics.
    Cached for 30 seconds to handle high traffic without DB overload.
    """
    global _dir_cache
    now = time.time()
    cache_key = f"dir_{sort_by}"
    if (
        _dir_cache.get('key') == cache_key
        and _dir_cache['data'] is not None
        and (now - _dir_cache['ts']) < _dir_cache['TTL']
    ):
        return _dir_cache['data']

    try:
        conn = get_connection()
        
        # 1. Fetch all official students
        official_rows = conn.execute("SELECT * FROM official_students ORDER BY id ASC").fetchall()
        
        # 2. Fetch all student_progress rows
        prog_rows = conn.execute("SELECT * FROM student_progress").fetchall()
        prog_map = {row['student_id']: dict(row) for row in prog_rows}
        
        # 3. Fetch best quiz attempts per student
        quiz_attempts_rows = conn.execute("""
            SELECT qa.* FROM quiz_attempts qa
            INNER JOIN (
                SELECT student_id, MAX(score_percent) as max_score
                FROM quiz_attempts
                GROUP BY student_id
            ) best ON qa.student_id = best.student_id AND qa.score_percent = best.max_score
            ORDER BY qa.time_taken_seconds ASC, qa.id DESC
        """).fetchall()
        best_quiz_map = {}
        for qr in quiz_attempts_rows:
            sid = qr['student_id']
            if sid not in best_quiz_map:
                d = dict(qr)
                try:
                    d['answers_detail'] = json.loads(d.get('answers_detail_json') or '[]')
                except Exception:
                    d['answers_detail'] = []
                best_quiz_map[sid] = d
        
        # 4. Fetch all QR scans grouped by student
        qr_scans_rows = conn.execute("SELECT student_id, booth_code, booth_name, points_earned, scanned_at FROM student_qr_scans ORDER BY scanned_at DESC").fetchall()
        qr_scans_map = {}
        for row in qr_scans_rows:
            sid = row['student_id']
            if sid not in qr_scans_map:
                qr_scans_map[sid] = []
            qr_scans_map[sid].append(dict(row))
            
        # 5. Fetch all workshop attendance grouped by student
        ws_rows = conn.execute("SELECT student_id, workshop_id, workshop_title, day_number, points_earned, attended_at FROM student_workshop_attendance ORDER BY attended_at DESC").fetchall()
        ws_map = {}
        for row in ws_rows:
            sid = row['student_id']
            if sid not in ws_map:
                ws_map[sid] = []
            ws_map[sid].append(dict(row))
            
        conn.close()
        
        # Collect all student IDs (both official + progress + quiz)
        all_ids = set()
        for o in official_rows:
            all_ids.add(o['student_id'])
        for p_id in prog_map.keys():
            all_ids.add(p_id)
        for q_id in best_quiz_map.keys():
            all_ids.add(q_id)
            
        students_list = []
        
        for sid in all_ids:
            off = next((o for o in official_rows if o['student_id'] == sid), None)
            prog = prog_map.get(sid, {})
            quiz = best_quiz_map.get(sid, None)
            scans = qr_scans_map.get(sid, [])
            workshops = ws_map.get(sid, [])
            
            student_name = ""
            if off and off['full_name']:
                student_name = off['full_name']
            elif prog.get('student_name'):
                student_name = prog.get('student_name')
            elif quiz and quiz.get('student_name'):
                student_name = quiz.get('student_name')
            else:
                student_name = f"طالب {sid}"
                
            college = off['college'] if off and off['college'] else "غير محدد"
            gender = off['gender'] if off and off['gender'] else "—"
            mobile_phone = off['mobile_phone'] if off and off['mobile_phone'] else "—"
            national_id = off['national_id'] if off and off['national_id'] else "—"
            
            # Explored docs parsing
            explored_docs = {}
            if prog.get('explored_docs_json'):
                try:
                    explored_docs = json.loads(prog['explored_docs_json'])
                except Exception:
                    explored_docs = {}
            docs_list = [{'id': k, 'name': v.get('name', k) if isinstance(v, dict) else k, 'pts': v.get('pts', 5) if isinstance(v, dict) else 5} for k, v in explored_docs.items()]
            docs_count = len(docs_list)
            
            # Quiz metrics
            has_attempted_quiz = bool(quiz is not None)
            quiz_score = float(quiz['score_percent']) if quiz else 0.0
            quiz_correct = int(quiz['correct_answers']) if quiz else 0
            quiz_total = int(quiz['total_questions']) if quiz else 0
            quiz_wrong = int(quiz.get('wrong_answers', max(0, quiz_total - quiz_correct))) if quiz else 0
            quiz_time_sec = int(quiz['time_taken_seconds']) if quiz and quiz['time_taken_seconds'] is not None else 999999
            quiz_answers_detail = quiz.get('answers_detail', []) if quiz else []
            quiz_date = quiz.get('created_at', '—') if quiz else '—'

            # If not recorded in standalone quiz table, check interactive journey quiz answers
            if (not has_attempted_quiz or not quiz_answers_detail) and prog.get('quiz_data_json'):
                try:
                    p_quiz = json.loads(prog['quiz_data_json'])
                    p_first = p_quiz.get('firstAttempt', {})
                    
                    # Try sources in priority order:
                    # 1. firstAttemptAnswered (top-level key from frontend)
                    # 2. firstAttempt.answered (nested key)
                    # 3. answered (main/current answers - fallback)
                    j_detail = []
                    p_ans_source = 'none'
                    
                    # Priority 1: top-level firstAttemptAnswered
                    top_first_ans = p_quiz.get('firstAttemptAnswered', {})
                    if top_first_ans and isinstance(top_first_ans, dict):
                        j_detail = build_journey_answers_detail(top_first_ans)
                        if j_detail:
                            p_ans_source = 'firstAttemptAnswered'
                    
                    # Priority 2: firstAttempt.answered (nested)
                    if not j_detail:
                        first_ans = p_first.get('answered', {})
                        if first_ans:
                            j_detail = build_journey_answers_detail(first_ans)
                            if j_detail:
                                p_ans_source = 'firstAttempt.answered'
                    
                    # Priority 3: main answered (fallback)
                    if not j_detail:
                        main_ans = p_quiz.get('answered', {})
                        if main_ans:
                            j_detail = build_journey_answers_detail(main_ans)
                            p_ans_source = 'main'
                    
                    if j_detail:
                        has_attempted_quiz = True
                        quiz_answers_detail = j_detail
                        quiz_correct = sum(1 for a in j_detail if a.get('is_correct'))
                        quiz_total = len(j_detail)
                        quiz_wrong = max(0, quiz_total - quiz_correct)
                        quiz_score = float(p_first.get('score', p_quiz.get('firstAttemptScore', round((quiz_correct / max(1, quiz_total)) * 100))))
                        quiz_time_sec = int(p_first.get('time', p_quiz.get('firstAttemptTime', p_quiz.get('seconds', 0))))
                        quiz_date = p_first.get('timestamp') or p_quiz.get('lastActive') or '—'
                except Exception:
                    pass
            
            if has_attempted_quiz and quiz_time_sec != 999999:
                m = quiz_time_sec // 60
                s = quiz_time_sec % 60
                quiz_time_fmt = f"{m:02d}:{s:02d} د"
            else:
                quiz_time_fmt = "—"
                
            total_points = float(prog.get('total_points', 0.0) or 0.0)
            explore_points = float(prog.get('explore_points', 0.0) or 0.0)
            quiz_points = float(prog.get('quiz_points', 0.0) or 0.0)
            campus_points = float(prog.get('campus_points', 0.0) or 0.0)
            workshop_points = float(prog.get('workshop_points', 0.0) or 0.0)
            
            students_list.append({
                'student_id': sid,
                'student_name': student_name,
                'college': college,
                'gender': gender,
                'mobile_phone': mobile_phone,
                'national_id': national_id,
                'has_attempted_quiz': has_attempted_quiz,
                'quiz_score': quiz_score,
                'quiz_correct': quiz_correct,
                'quiz_total': quiz_total,
                'quiz_wrong': quiz_wrong,
                'quiz_time_seconds': quiz_time_sec if has_attempted_quiz else 999999,
                'quiz_time_formatted': quiz_time_fmt,
                'quiz_answers_detail': quiz_answers_detail,
                'quiz_date': quiz_date,
                'docs_count': docs_count,
                'docs_list': docs_list,
                'explore_points': explore_points,
                'stations_count': len(scans),
                'stations_list': scans,
                'campus_points': campus_points,
                'workshops_count': len(workshops),
                'workshops_list': workshops,
                'workshop_points': workshop_points,
                'quiz_points': quiz_points,
                'total_points': total_points,
                'updated_at': prog.get('updated_at') or (quiz.get('created_at') if quiz else '—')
            })
            
        # Sorting
        if sort_by == 'score_desc':
            students_list.sort(key=lambda s: (-s['quiz_score'], s['quiz_time_seconds'], -s['total_points']))
        elif sort_by == 'time_asc':
            students_list.sort(key=lambda s: (0 if s['has_attempted_quiz'] else 1, s['quiz_time_seconds'], -s['quiz_score']))
        elif sort_by == 'points_desc':
            students_list.sort(key=lambda s: (-s['total_points'], -s['quiz_score'], s['quiz_time_seconds']))
        elif sort_by == 'docs_desc':
            students_list.sort(key=lambda s: (-s['docs_count'], -s['total_points'], -s['quiz_score']))
        elif sort_by == 'scans_desc':
            students_list.sort(key=lambda s: (-(s['stations_count'] + s['workshops_count']), -s['total_points']))
        else: # 'smart' — ترتيب حسب النقاط أولاً + وقت الاختبار عند التعادل
            students_list.sort(key=lambda s: (
                -s['total_points'],
                s['quiz_time_seconds'],
                -s['quiz_score'],
                -s['docs_count'],
                -(s['stations_count'] + s['workshops_count'])
            ))
            
        # Assign ranks
        for idx, stu in enumerate(students_list, 1):
            stu['rank'] = idx
        
        # ─── Save to cache ────────────────────────────────────────────────────
        _dir_cache['data'] = students_list
        _dir_cache['ts'] = time.time()
        _dir_cache['key'] = cache_key
        return students_list
    except Exception as e:
        print(f"[Analytics] get_all_students_comprehensive_directory_db error: {e}")
        return _dir_cache.get('data') or []  # Return stale cache on error
def get_single_student_full_dossier_db(student_id):
    """Retrieve complete 360-degree dossier for a single student including uploaded proofs, video progress, and checklists."""
    if not student_id:
        return None
    clean_id = str(student_id).strip()
    try:
        all_students = get_all_students_comprehensive_directory_db(sort_by='smart')
        student = next((s for s in all_students if s['student_id'] == clean_id), None)
        if not student:
            return None
            
        conn = get_connection()
        prog = conn.execute("SELECT * FROM student_progress WHERE student_id = ?", (clean_id,)).fetchone()
        all_attempts = conn.execute("SELECT * FROM quiz_attempts WHERE student_id = ? ORDER BY id DESC", (clean_id,)).fetchall()
        activities = conn.execute("SELECT activity_type, item_id, item_title, points_earned, created_at FROM student_activities WHERE student_id = ? ORDER BY id DESC LIMIT 50", (clean_id,)).fetchall()
        survey = conn.execute("SELECT * FROM survey_responses WHERE student_id = ?", (clean_id,)).fetchone()
        video_views = conn.execute("SELECT * FROM student_video_views WHERE student_id = ? ORDER BY video_index ASC", (clean_id,)).fetchall()
        video_views_map = {row['video_index']: dict(row) for row in video_views}
        conn.close()
        
        parsed_attempts = []
        for a in all_attempts:
            ad = dict(a)
            try:
                ad['answers_detail'] = json.loads(ad.get('answers_detail_json') or '[]')
            except Exception:
                ad['answers_detail'] = []
            parsed_attempts.append(ad)
            
        quiz_data = {}
        if prog and prog['quiz_data_json']:
            try:
                quiz_data = json.loads(prog['quiz_data_json'])
            except Exception:
                quiz_data = {}
        
        campus_data = {}
        if prog and prog['campus_data_json']:
            try:
                campus_data = json.loads(prog['campus_data_json'])
            except Exception:
                campus_data = {}
                
        # Extract uploaded proof images: Priority 1 is First Attempt Proofs (Official Certified)
        first_attempt_proofs = quiz_data.get('firstAttemptProofs', {}) or {}
        first_attempt_data = quiz_data.get('firstAttempt', {}) or {}
        first_attempt_answered = first_attempt_data.get('answered', {}) or {}
        # Fallback: frontend sends firstAttemptAnswered as top-level key
        if not first_attempt_answered or len(first_attempt_answered) == 0:
            first_attempt_answered = quiz_data.get('firstAttemptAnswered', {}) or {}
        proofs = quiz_data.get('proofs', {}) or {}
        latest_proofs = quiz_data.get('latestProofs', {}) or {}
        answered = quiz_data.get('answered', {}) or {}
        
        email_proof = first_attempt_proofs.get('email') or first_attempt_answered.get(10) or first_attempt_answered.get('10') or proofs.get('email')
        bb_proof = first_attempt_proofs.get('blackboard') or first_attempt_answered.get(11) or first_attempt_answered.get('11') or proofs.get('blackboard')

        if not email_proof:
            for k, v in answered.items():
                if isinstance(v, dict) and ('email' in str(v.get('type', '')).lower() or str(k) == '10'):
                    email_proof = v
                    break

        if not bb_proof:
            for k, v in answered.items():
                if isinstance(v, dict) and ('bb' in str(v.get('type', '')).lower() or 'blackboard' in str(v.get('type', '')).lower() or str(k) == '11'):
                    bb_proof = v
                    break

        # Extract latest active proofs as well
        latest_email_proof = latest_proofs.get('email') or answered.get(10) or answered.get('10')
        latest_bb_proof = latest_proofs.get('blackboard') or answered.get(11) or answered.get('11')
            
        # Fallback: scan disk folder static/uploads/proofs/ for files starting with student_id
        # Priority: _first files = immutable first attempt, _latest files = most recent upload
        try:
            upload_dir = os.path.join(_PROJECT_ROOT, 'static', 'uploads', 'proofs')
            if os.path.exists(upload_dir):
                first_email_disk = None
                first_bb_disk = None
                latest_email_disk = None
                latest_bb_disk = None
                
                for fname in sorted(os.listdir(upload_dir), reverse=True):
                    if not fname.startswith(clean_id):
                        continue
                    furl = f"/static/uploads/proofs/{fname}"
                    fname_lower = fname.lower()
                    is_first = '_first' in fname_lower
                    is_email = 'email' in fname_lower
                    is_bb = 'bb' in fname_lower or 'blackboard' in fname_lower
                    
                    if is_email:
                        if is_first and not first_email_disk:
                            first_email_disk = {'url': furl, 'dataUrl': furl, 'fileName': fname, 'type': 'email'}
                        elif not is_first and not latest_email_disk:
                            latest_email_disk = {'url': furl, 'dataUrl': furl, 'fileName': fname, 'type': 'email'}
                    elif is_bb:
                        if is_first and not first_bb_disk:
                            first_bb_disk = {'url': furl, 'dataUrl': furl, 'fileName': fname, 'type': 'bb'}
                        elif not is_first and not latest_bb_disk:
                            latest_bb_disk = {'url': furl, 'dataUrl': furl, 'fileName': fname, 'type': 'bb'}
                
                # Official proof = first attempt from disk (if exists), then from quiz_data
                if first_email_disk and not email_proof:
                    email_proof = first_email_disk
                elif first_email_disk and isinstance(email_proof, dict) and not email_proof.get('url'):
                    email_proof['url'] = first_email_disk['url']
                elif not email_proof and latest_email_disk:
                    email_proof = latest_email_disk
                    
                if first_bb_disk and not bb_proof:
                    bb_proof = first_bb_disk
                elif first_bb_disk and isinstance(bb_proof, dict) and not bb_proof.get('url'):
                    bb_proof['url'] = first_bb_disk['url']
                elif not bb_proof and latest_bb_disk:
                    bb_proof = latest_bb_disk
                    
                # Latest proofs from disk — override DB data if stale/pending
                def _is_stale(proof):
                    """Check if proof data is unusable (pending_upload or no valid URL)"""
                    if not proof:
                        return True
                    if not isinstance(proof, dict):
                        return True
                    du = proof.get('dataUrl', '')
                    u = proof.get('url', '')
                    return du in ('', 'pending_upload') and u in ('', 'pending_upload')
                
                if latest_email_disk and (not latest_email_proof or _is_stale(latest_email_proof)):
                    latest_email_proof = latest_email_disk
                if latest_bb_disk and (not latest_bb_proof or _is_stale(latest_bb_proof)):
                    latest_bb_proof = latest_bb_disk
                
                # ═══ AUTO-RECOVER: Save base64 dataUrl proofs to disk if no file exists ═══
                # This fixes students who uploaded proofs that were stored as base64 in DB
                # but were never written to disk (e.g., upload endpoint failed silently)
                def save_base64_proof_to_disk(proof_obj, sid, ptype):
                    """Extract base64 dataUrl from proof object and save as file on disk."""
                    if not isinstance(proof_obj, dict):
                        return proof_obj
                    du = proof_obj.get('dataUrl', '')
                    existing_url = proof_obj.get('url', '')
                    if existing_url and existing_url.startswith('/static/'):
                        return proof_obj  # Already has a server URL
                    if not du or not du.startswith('data:'):
                        return proof_obj  # No base64 to extract
                    try:
                        import base64, re as _re
                        # Parse data URL: data:[mime];base64,[data]
                        match = _re.match(r'data:([^;]+);base64,(.+)', du, _re.DOTALL)
                        if not match:
                            return proof_obj
                        mime = match.group(1)
                        b64data = match.group(2).strip()
                        img_bytes = base64.b64decode(b64data)
                        # Determine extension from mime
                        ext_map = {'image/png': '.png', 'image/jpeg': '.jpg', 'image/jpg': '.jpg',
                                   'image/webp': '.webp', 'image/gif': '.gif'}
                        ext = ext_map.get(mime, '.png')
                        from datetime import datetime as _dt
                        ts = _dt.now().strftime("%Y%m%d_%H%M%S")
                        import re as _re2
                        safe_sid = _re2.sub(r'[^a-zA-Z0-9_-]', '', sid)
                        safe_type = _re2.sub(r'[^a-zA-Z0-9_-]', '', ptype).lower()
                        # Save as _first (since this is the only known proof)
                        fname = f"{safe_sid}_{safe_type}_first_{ts}{ext}"
                        fpath = os.path.join(upload_dir, fname)
                        if not os.path.exists(fpath):
                            with open(fpath, 'wb') as fp:
                                fp.write(img_bytes)
                            print(f"[Analytics] Auto-recovered proof from base64: {fname} ({len(img_bytes)} bytes)")
                        file_url = f"/static/uploads/proofs/{fname}"
                        proof_obj = dict(proof_obj)
                        proof_obj['url'] = file_url
                        proof_obj['dataUrl'] = file_url  # Replace huge base64 with URL
                        proof_obj['auto_recovered'] = True
                        return proof_obj
                    except Exception as rec_err:
                        print(f"[Analytics] Failed to auto-recover proof: {rec_err}")
                        return proof_obj
                
                if email_proof and isinstance(email_proof, dict):
                    email_proof = save_base64_proof_to_disk(email_proof, clean_id, 'email')
                if bb_proof and isinstance(bb_proof, dict):
                    bb_proof = save_base64_proof_to_disk(bb_proof, clean_id, 'blackboard')
                    
        except Exception as err:
            print(f"[Analytics] Error scanning disk proofs: {err}")

        # Dynamically load active landing videos from data/landing_config.json
        config_path = os.path.join(_PROJECT_ROOT, 'data', 'landing_config.json')
        configured_videos = []
        try:
            if os.path.exists(config_path):
                with open(config_path, 'r', encoding='utf-8') as f:
                    cfg = json.load(f)
                    configured_videos = cfg.get('videos', [])
        except Exception:
            configured_videos = []

        # Also include station videos from the database
        try:
            db_station_videos = get_active_station_videos_db()
            for sv in db_station_videos:
                configured_videos.append({
                    "url": sv.get('url', ''),
                    "caption": sv.get('title', ''),
                    "station_video_id": sv.get('id'),
                    "station_num": sv.get('station_num')
                })
        except Exception:
            pass

        if not configured_videos:
            configured_videos = [{"url": "/static/uploads/welcome_video.mp4", "caption": "المقطع التعريفي الرئيسي"}]

        watched_videos_list = quiz_data.get('watchedVideosList', {})
        watched_video_legacy = quiz_data.get('watchedVideo', False)
        
        student_videos_detailed = []
        completed_videos_count = 0
        total_configured = len(configured_videos)

        for v_idx, v_cfg in enumerate(configured_videos):
            v_caption = v_cfg.get('caption') or f"المقطع {v_idx + 1}"
            v_url = v_cfg.get('url') or ""
            
            v_rec = video_views_map.get(v_idx)
            is_done = False
            w_sec = 0
            c_pct = 0.0
            last_watched = ""
            
            if v_rec and (v_rec.get('is_completed') or v_rec.get('completion_percent', 0) >= 75):
                is_done = True
                w_sec = v_rec.get('watched_seconds', 0)
                c_pct = v_rec.get('completion_percent', 100)
                last_watched = v_rec.get('last_watched_at', '')
            elif str(v_idx) in watched_videos_list or watched_videos_list.get(v_idx) or (v_idx == 0 and watched_video_legacy):
                is_done = True
                c_pct = 100.0
                
            if is_done:
                completed_videos_count += 1
                
            student_videos_detailed.append({
                "video_index": v_idx,
                "video_number": v_idx + 1,
                "video_caption": v_caption,
                "video_url": v_url,
                "is_completed": is_done,
                "completion_percent": c_pct,
                "watched_seconds": w_sec,
                "last_watched_at": last_watched
            })

        completion_ratio = round((completed_videos_count / total_configured) * 100) if total_configured > 0 else 0
        if completed_videos_count == total_configured and total_configured > 0:
            video_watch_status = 'all_completed'
            video_watch_label = f'شاهد جميع المقاطع ({completed_videos_count} من {total_configured}) 100% 👑'
        elif completed_videos_count > 0:
            video_watch_status = 'partial'
            video_watch_label = f'شاهد جزئياً ({completed_videos_count} من {total_configured}) ⏳'
        else:
            video_watch_status = 'none'
            video_watch_label = f'لم يشاهد أي مقطع (0 من {total_configured}) ❌'

        student['all_attempts'] = parsed_attempts
        student['recent_activities'] = [dict(act) for act in activities]
        student['survey_response'] = dict(survey) if survey else None
        student['proof_email'] = email_proof
        student['proof_blackboard'] = bb_proof
        student['latest_proof_email'] = latest_email_proof
        student['latest_proof_blackboard'] = latest_bb_proof
        student['first_attempt'] = quiz_data.get('firstAttempt', {})
        student['first_attempt_proofs'] = quiz_data.get('firstAttemptProofs', {})
        student['attempts_history'] = quiz_data.get('attemptsHistory', [])
        student['checklist_verified'] = quiz_data.get('checklistVerified', {})
        student['checklist_answers'] = quiz_data.get('checklistAnswers', {})
        student['watched_video'] = quiz_data.get('watchedVideo', False)
        student['watched_videos_list'] = quiz_data.get('watchedVideosList', {})
        student['video_views_records'] = [dict(v) for v in video_views]
        student['video_views_map'] = video_views_map
        student['total_configured_videos'] = total_configured
        student['completed_videos_count'] = completed_videos_count
        student['video_completion_ratio'] = completion_ratio
        student['video_watch_status'] = video_watch_status
        student['video_watch_label'] = video_watch_label
        student['student_videos_detailed'] = student_videos_detailed
        student['campus_journey_data'] = campus_data
        
        # Ensure questions breakdown (quiz_answers_detail) is completely populated for Admin dossier
        if not student.get('quiz_answers_detail') or len(student['quiz_answers_detail']) == 0:
            # Try first attempt answers, then fall back to main answered
            # (firstAttempt.answered may contain only proof images which don't produce quiz detail)
            journey_ans = []
            if first_attempt_answered:
                journey_ans = build_journey_answers_detail(first_attempt_answered)
            if not journey_ans and answered:
                journey_ans = build_journey_answers_detail(answered)
            
            if journey_ans:
                student['quiz_answers_detail'] = journey_ans
                student['has_attempted_quiz'] = True
                corr_cnt = sum(1 for a in journey_ans if a.get('is_correct'))
                tot_cnt = len(journey_ans)
                student['quiz_correct'] = corr_cnt
                student['quiz_total'] = tot_cnt
                student['quiz_wrong'] = max(0, tot_cnt - corr_cnt)
                student['quiz_score'] = first_attempt_data.get('score', round((corr_cnt / max(1, tot_cnt)) * 100))
                time_sec = int(first_attempt_data.get('time', quiz_data.get('seconds', 0)))
                student['quiz_time_seconds'] = time_sec
                student['quiz_time_formatted'] = f"{time_sec // 60:02d}:{time_sec % 60:02d} د"
                student['quiz_date'] = first_attempt_data.get('timestamp') or quiz_data.get('lastActive') or '—'

        return student
    except Exception as e:
        print(f"[Analytics] get_single_student_full_dossier_db error: {e}")
        return None
