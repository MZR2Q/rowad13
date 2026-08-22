"""Student video-view analytics and admin-managed station videos."""
import os
import json
import time

from .db import get_connection, _PROJECT_ROOT

def record_student_video_view_db(student_id, student_name, video_index, video_url="", video_caption="", watched_seconds=0, video_duration=0, is_completed=1):
    """Record or update student video viewing event into SQLite database."""
    if not student_id or str(student_id).strip() == 'guest_student':
        return False
    clean_id = str(student_id).strip()
    try:
        conn = get_connection()
        calc_percent = 0.0
        w_sec = float(watched_seconds or 0)
        v_dur = float(video_duration or 0)
        if v_dur > 0:
            calc_percent = min(100.0, round((w_sec / v_dur) * 100.0, 1))
        elif is_completed:
            calc_percent = 100.0

        completed_val = 1 if (is_completed or calc_percent >= 75.0) else 0

        conn.execute("""
            INSERT INTO student_video_views (
                student_id, student_name, video_index, video_url, video_caption,
                watched_seconds, video_duration, completion_percent, is_completed, last_watched_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(student_id, video_index) DO UPDATE SET
                student_name = COALESCE(excluded.student_name, student_video_views.student_name),
                video_url = CASE WHEN excluded.video_url != '' THEN excluded.video_url ELSE student_video_views.video_url END,
                video_caption = CASE WHEN excluded.video_caption != '' THEN excluded.video_caption ELSE student_video_views.video_caption END,
                watched_seconds = MAX(student_video_views.watched_seconds, excluded.watched_seconds),
                video_duration = MAX(student_video_views.video_duration, excluded.video_duration),
                completion_percent = MAX(student_video_views.completion_percent, excluded.completion_percent),
                is_completed = MAX(student_video_views.is_completed, excluded.is_completed),
                last_watched_at = CURRENT_TIMESTAMP
        """, (clean_id, student_name, int(video_index), str(video_url), str(video_caption), w_sec, v_dur, calc_percent, completed_val))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"[Analytics] record_student_video_view_db error: {e}")
        return False


def get_all_students_video_analytics_db():
    """Retrieve comprehensive video viewing analytics across all registered university students."""
    try:
        # 1. Load configured landing videos from landing_config.json
        config_path = os.path.join(_PROJECT_ROOT, 'data', 'landing_config.json')
        configured_videos = []
        try:
            if os.path.exists(config_path):
                with open(config_path, 'r', encoding='utf-8') as f:
                    cfg = json.load(f)
                    configured_videos = cfg.get('videos', [])
        except Exception:
            configured_videos = []

        if not configured_videos:
            configured_videos = [{"url": "/static/uploads/welcome_video.mp4", "caption": "المقطع التعريفي الرئيسي"}]

        total_configured = len(configured_videos)

        conn = get_connection()
        # Get all official students + any in video views or student progress
        students_rows = conn.execute("""
            SELECT DISTINCT 
                s.student_id, 
                s.full_name, 
                s.college, 
                s.gender, 
                s.mobile_phone,
                p.total_points,
                p.quiz_data_json
            FROM official_students s
            LEFT JOIN student_progress p ON s.student_id = p.student_id
            ORDER BY s.student_id ASC
        """).fetchall()

        all_video_views = conn.execute("""
            SELECT student_id, video_index, video_url, video_caption, watched_seconds, video_duration, completion_percent, is_completed, last_watched_at
            FROM student_video_views
            ORDER BY video_index ASC
        """).fetchall()
        conn.close()

        views_by_student = {}
        for row in all_video_views:
            sid = row['student_id']
            if sid not in views_by_student:
                views_by_student[sid] = {}
            views_by_student[sid][row['video_index']] = dict(row)

        students_analytics = []
        completed_all_count = 0
        partial_viewers_count = 0
        non_viewers_count = 0
        total_video_plays = len(all_video_views)

        for s in students_rows:
            sid = s['student_id']
            s_name = s['full_name']
            s_views = views_by_student.get(sid, {})

            # Also check quiz_data_json as fallback
            quiz_data = {}
            if s['quiz_data_json']:
                try:
                    quiz_data = json.loads(s['quiz_data_json'])
                except Exception:
                    quiz_data = {}

            watched_videos_list = quiz_data.get('watchedVideosList', {})
            watched_video_legacy = quiz_data.get('watchedVideo', False)

            videos_status = []
            completed_in_student = 0

            for v_idx, v_cfg in enumerate(configured_videos):
                v_caption = v_cfg.get('caption') or f"المقطع {v_idx + 1}"
                v_url = v_cfg.get('url') or ""
                
                v_record = s_views.get(v_idx)
                is_done = False
                w_sec = 0
                c_pct = 0.0
                last_time = ""

                if v_record and (v_record.get('is_completed') or v_record.get('completion_percent', 0) >= 75):
                    is_done = True
                    w_sec = v_record.get('watched_seconds', 0)
                    c_pct = v_record.get('completion_percent', 100)
                    last_time = v_record.get('last_watched_at', '')
                elif str(v_idx) in watched_videos_list or watched_videos_list.get(v_idx) or (v_idx == 0 and watched_video_legacy):
                    is_done = True
                    c_pct = 100.0

                if is_done:
                    completed_in_student += 1

                videos_status.append({
                    "video_index": v_idx,
                    "video_caption": v_caption,
                    "video_url": v_url,
                    "is_completed": is_done,
                    "completion_percent": c_pct,
                    "watched_seconds": w_sec,
                    "last_watched_at": last_time
                })

            completion_ratio = round((completed_in_student / total_configured) * 100) if total_configured > 0 else 0
            
            if completed_in_student == total_configured and total_configured > 0:
                watch_status = 'all_completed'
                watch_status_label = 'شاهد جميع المقاطع (100%) 👑'
                completed_all_count += 1
            elif completed_in_student > 0:
                watch_status = 'partial'
                watch_status_label = f'شاهد جزئياً ({completed_in_student} من {total_configured}) ⏳'
                partial_viewers_count += 1
            else:
                watch_status = 'none'
                watch_status_label = 'لم يشاهد أي مقطع ❌'
                non_viewers_count += 1

            students_analytics.append({
                "student_id": sid,
                "student_name": s_name,
                "college": s['college'] or 'غير محدد',
                "gender": s['gender'] or '—',
                "mobile_phone": s['mobile_phone'] or '—',
                "total_points": float(s['total_points'] or 0),
                "total_configured_videos": total_configured,
                "completed_videos_count": completed_in_student,
                "completion_ratio": completion_ratio,
                "watch_status": watch_status,
                "watch_status_label": watch_status_label,
                "videos_status": videos_status
            })

        # Sort: all completed first, then highest completion ratio, then points
        students_analytics.sort(key=lambda x: (-x['completed_videos_count'], -x['completion_ratio'], -x['total_points']))

        # Assign video viewer ranks
        for idx, item in enumerate(students_analytics, 1):
            item['rank'] = idx

        return {
            "total_students": len(students_rows),
            "total_configured_videos": total_configured,
            "configured_videos": configured_videos,
            "completed_all_count": completed_all_count,
            "partial_viewers_count": partial_viewers_count,
            "non_viewers_count": non_viewers_count,
            "total_video_plays": total_video_plays,
            "students": students_analytics
        }
    except Exception as e:
        print(f"[Analytics] get_all_students_video_analytics_db error: {e}")
        return {
            "total_students": 0,
            "total_configured_videos": 0,
            "configured_videos": [],
            "completed_all_count": 0,
            "partial_viewers_count": 0,
            "non_viewers_count": 0,
            "total_video_plays": 0,
            "students": []
        }


# ════════════════════════════════════════════════════════════════════════════════
# ─── Station Videos CRUD (Admin-managed videos linked to virtual stations) ─────
# ════════════════════════════════════════════════════════════════════════════════
def get_all_station_videos_db():
    """Get all station videos for admin management."""
    try:
        conn = get_connection()
        rows = conn.execute("SELECT * FROM station_videos ORDER BY sort_order ASC, id ASC").fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"[Analytics] get_all_station_videos_db error: {e}")
        return []


def get_active_station_videos_db():
    """Get only active station videos for student display."""
    try:
        conn = get_connection()
        rows = conn.execute(
            "SELECT id, title, url, station_num, sort_order FROM station_videos WHERE is_active = 1 ORDER BY sort_order ASC, id ASC"
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"[Analytics] get_active_station_videos_db error: {e}")
        return []


def add_station_video_db(title, url, station_num=None, sort_order=0):
    """Add a new station video."""
    if not title or not url:
        return {'success': False, 'message': 'العنوان والرابط مطلوبان'}
    try:
        conn = get_connection()
        sn = int(station_num) if station_num and str(station_num).strip() not in ('', 'null', 'none', '0') else None
        cur = conn.execute("""
            INSERT INTO station_videos (title, url, station_num, sort_order, is_active, created_at)
            VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
        """, (str(title).strip(), str(url).strip(), sn, int(sort_order or 0)))
        conn.commit()
        new_id = cur.lastrowid
        conn.close()
        return {'success': True, 'id': new_id, 'message': 'تم إضافة المقطع بنجاح'}
    except Exception as e:
        print(f"[Analytics] add_station_video_db error: {e}")
        return {'success': False, 'message': str(e)}


def update_station_video_db(video_id, title=None, url=None, station_num='__unchanged__', sort_order=None, is_active=None):
    """Update an existing station video."""
    try:
        conn = get_connection()
        existing = conn.execute("SELECT id FROM station_videos WHERE id = ?", (int(video_id),)).fetchone()
        if not existing:
            conn.close()
            return {'success': False, 'message': 'المقطع غير موجود'}

        updates = []
        params = []
        if title is not None:
            updates.append("title = ?")
            params.append(str(title).strip())
        if url is not None:
            updates.append("url = ?")
            params.append(str(url).strip())
        if station_num != '__unchanged__':
            sn = int(station_num) if station_num and str(station_num).strip() not in ('', 'null', 'none', '0') else None
            updates.append("station_num = ?")
            params.append(sn)
        if sort_order is not None:
            updates.append("sort_order = ?")
            params.append(int(sort_order))
        if is_active is not None:
            updates.append("is_active = ?")
            params.append(1 if is_active else 0)

        if not updates:
            conn.close()
            return {'success': True, 'message': 'لا توجد تعديلات'}

        params.append(int(video_id))
        conn.execute(f"UPDATE station_videos SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()
        conn.close()
        return {'success': True, 'message': 'تم تحديث المقطع بنجاح'}
    except Exception as e:
        print(f"[Analytics] update_station_video_db error: {e}")
        return {'success': False, 'message': str(e)}


def delete_station_video_db(video_id):
    """Delete a station video."""
    try:
        conn = get_connection()
        conn.execute("DELETE FROM station_videos WHERE id = ?", (int(video_id),))
        conn.commit()
        conn.close()
        return {'success': True, 'message': 'تم حذف المقطع بنجاح'}
    except Exception as e:
        print(f"[Analytics] delete_station_video_db error: {e}")
        return {'success': False, 'message': str(e)}
