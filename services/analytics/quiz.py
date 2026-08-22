"""Quiz bank: questions, categories, attempts, leaderboard, journey quiz DB access."""
import json

from .db import get_connection

def get_journey_questions_from_db():
    """Load journey quiz questions from DB. Returns list of dicts for frontend and admin."""
    try:
        conn = get_connection()
        rows = conn.execute("""
            SELECT id, question, option_a, option_b, option_c, option_d,
                   correct_option, explanation, article_ref, document_name,
                   slide_number, station_number, image_url, images_json
            FROM quiz_questions
            WHERE is_journey = 1
            ORDER BY slide_number ASC
        """).fetchall()
        conn.close()

        questions = []
        # Map correct_option letter to index
        letter_to_idx = {'a': 0, 'b': 1, 'c': 2, 'd': 3}

        for r in rows:
            d = dict(r)
            # Build options list (skip empty option_d)
            options = [d['option_a'], d['option_b']]
            options_letters = ['أ', 'ب']
            if d['option_c']:
                options.append(d['option_c'])
                options_letters.append('ج')
            if d['option_d']:
                options.append(d['option_d'])
                options_letters.append('د')

            correct_idx = letter_to_idx.get(str(d['correct_option']).lower().strip(), 0)

            # Station name mapping
            station_names = {
                1: "المحطة الأولى: عن الجامعة",
                2: "المحطة الثانية: الأنظمة التقنية",
                3: "المحطة الثالثة: حقوقك وواجباتك",
                4: "المحطة الرابعة: القبول والتسجيل",
                5: "المحطة الخامسة: شؤون الطلاب",
            }

            questions.append({
                "db_id": d['id'],
                "slide": d['slide_number'],
                "station_number": d['station_number'],
                "station": station_names.get(d['station_number'], f"المحطة {d['station_number']}"),
                "question": d['question'],
                "options": options,
                "options_letters": options_letters,
                "correct_option_idx": correct_idx,
                "explanation": d['explanation'] or '',
                "article_ref": d['article_ref'] or d['document_name'] or '',
                "image_url": d.get('image_url') or '',
                "images": json.loads(d.get('images_json') or '[]') if d.get('images_json') else []
            })

        return questions
    except Exception as e:
        print(f"[Analytics] get_journey_questions_from_db error: {e}")
        return []


def get_journey_questions_for_student():
    """Get journey questions for student frontend (WITHOUT correct answers for security)."""
    questions = get_journey_questions_from_db()
    safe = []
    for q in questions:
        safe.append({
            "slide": q["slide"],
            "station_number": q["station_number"],
            "station": q["station"],
            "question": q["question"],
            "options": q["options"],
            "options_letters": q["options_letters"],
            "explanation": q["explanation"],
            "article_ref": q["article_ref"],
            "image_url": q.get("image_url", ""),
            "images": q.get("images", [])
            # NOTE: correct_option_idx is NOT included — answer is verified server-side
        })
    return safe


def get_journey_correct_answers_map():
    """Get {slide_number: correct_option_idx} map for server-side answer checking."""
    questions = get_journey_questions_from_db()
    return {q["slide"]: q["correct_option_idx"] for q in questions}


# ─── Quiz Helper Functions ─────────────────────────────────
def get_quiz_questions_count(category_id=None):
    """Get count of quiz questions in bank (optionally by category_id)."""
    try:
        conn = get_connection()
        if category_id:
            count = conn.execute("SELECT COUNT(*) FROM quiz_questions WHERE category_id = ?", (category_id,)).fetchone()[0]
        else:
            count = conn.execute("SELECT COUNT(*) FROM quiz_questions").fetchone()[0]
        conn.close()
        return count
    except Exception as e:
        print(f"[Analytics] get_quiz_questions_count error: {e}")
        return 0


def get_random_quiz_questions(count=5, category_id=None):
    """Get random questions from the quiz bank (optionally filtered by category_id)."""
    try:
        conn = get_connection()
        if category_id:
            rows = conn.execute(
                "SELECT id, question, option_a, option_b, option_c, option_d, correct_option, explanation, article_ref, document_name, image_url, category_id, category_name FROM quiz_questions WHERE category_id = ? ORDER BY RANDOM() LIMIT ?",
                (category_id, count)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, question, option_a, option_b, option_c, option_d, correct_option, explanation, article_ref, document_name, image_url, category_id, category_name FROM quiz_questions ORDER BY RANDOM() LIMIT ?",
                (count,)
            ).fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"[Analytics] get_random_quiz_questions error: {e}")
        return []
def save_quiz_attempt(student_id, student_name, total_questions, correct_answers,
                      score_percent, time_taken_seconds, wrong_answers=None,
                      category_name=None, answers_detail=None):
    """Save a quiz attempt result with detailed question answers."""
    try:
        conn = get_connection()
        c = conn.cursor()
        if wrong_answers is None:
            wrong_answers = max(0, int(total_questions or 0) - int(correct_answers or 0))
        
        detail_str = answers_detail if isinstance(answers_detail, str) else json.dumps(answers_detail or [], ensure_ascii=False)

        c.execute(
            """INSERT INTO quiz_attempts
               (student_id, student_name, total_questions, correct_answers, wrong_answers, score_percent, time_taken_seconds, category_name, answers_detail_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (str(student_id).strip(), str(student_name).strip(), int(total_questions or 0),
             int(correct_answers or 0), int(wrong_answers or 0), float(score_percent or 0),
             int(time_taken_seconds or 0), str(category_name or ''), detail_str)
        )
        attempt_id = c.lastrowid
        conn.commit()
        conn.close()
        return attempt_id
    except Exception as e:
        print(f"[Analytics] save_quiz_attempt error: {e}")
        return None


def get_all_quiz_attempts(limit=100, student_id=None):
    """Retrieve all student quiz attempts with parsed answers detail."""
    try:
        conn = get_connection()
        if student_id:
            rows = conn.execute("""
                SELECT * FROM quiz_attempts
                WHERE student_id = ?
                ORDER BY id DESC
                LIMIT ?
            """, (str(student_id).strip(), limit)).fetchall()
        else:
            rows = conn.execute("""
                SELECT * FROM quiz_attempts
                ORDER BY id DESC
                LIMIT ?
            """, (limit,)).fetchall()
        conn.close()

        results = []
        for r in rows:
            d = dict(r)
            try:
                raw = d.get('answers_detail_json')
                d['answers_detail'] = json.loads(raw) if raw else []
            except Exception:
                d['answers_detail'] = []
            if 'wrong_answers' not in d or d['wrong_answers'] is None:
                d['wrong_answers'] = max(0, int(d.get('total_questions', 0) or 0) - int(d.get('correct_answers', 0) or 0))
            results.append(d)
        return results
    except Exception as e:
        print(f"[Analytics] get_all_quiz_attempts error: {e}")
        return []


def get_quiz_attempt_by_id(attempt_id):
    """Retrieve a single quiz attempt with full question breakdown."""
    try:
        conn = get_connection()
        row = conn.execute("SELECT * FROM quiz_attempts WHERE id = ?", (attempt_id,)).fetchone()
        conn.close()
        if not row:
            return None
        d = dict(row)
        try:
            raw = d.get('answers_detail_json')
            d['answers_detail'] = json.loads(raw) if raw else []
        except Exception:
            d['answers_detail'] = []
        if 'wrong_answers' not in d or d['wrong_answers'] is None:
            d['wrong_answers'] = max(0, int(d.get('total_questions', 0) or 0) - int(d.get('correct_answers', 0) or 0))
        return d
    except Exception as e:
        print(f"[Analytics] get_quiz_attempt_by_id error: {e}")
        return None


def get_quiz_leaderboard(limit=3):
    """Get the top students ranked by total_points (out of 200) with quiz time as tiebreaker."""
    try:
        conn = get_connection()
        rows = conn.execute("""
            SELECT student_id, student_name, total_points,
                   explore_points, quiz_points, campus_points, workshop_points,
                   quiz_data_json
            FROM student_progress
            WHERE total_points > 0
            ORDER BY total_points DESC, updated_at ASC
            LIMIT ?
        """, (limit,)).fetchall()
        conn.close()

        results = []
        for r in rows:
            quiz_time = 0
            try:
                qd = json.loads(r['quiz_data_json'] or '{}')
                quiz_time = int(qd.get('time_taken_seconds', 0) or 0)
            except Exception:
                pass
            results.append({
                'student_id': r['student_id'],
                'student_name': r['student_name'],
                'best_score': float(r['total_points'] or 0),
                'best_time': quiz_time,
                'explore_points': float(r['explore_points'] or 0),
                'quiz_points': float(r['quiz_points'] or 0),
                'campus_points': float(r['campus_points'] or 0),
                'workshop_points': float(r['workshop_points'] or 0),
            })

        # Sort by total points DESC then quiz time ASC (tiebreaker)
        results.sort(key=lambda x: (-x['best_score'], x['best_time']))
        return results[:limit]
    except Exception as e:
        print(f"[Analytics] get_quiz_leaderboard error: {e}")
        return []
def get_all_quiz_questions(category_id=None):
    """Retrieve all quiz questions from DB (optionally filtered by category_id)."""
    try:
        conn = get_connection()
        if category_id:
            rows = conn.execute("""
                SELECT id, question, option_a, option_b, option_c, option_d,
                       correct_option, explanation, article_ref, document_name,
                       image_url, category_id, category_name, created_at, images_json
                FROM quiz_questions
                WHERE category_id = ?
                ORDER BY id DESC
            """, (category_id,)).fetchall()
        else:
            rows = conn.execute("""
                SELECT id, question, option_a, option_b, option_c, option_d,
                       correct_option, explanation, article_ref, document_name,
                       image_url, category_id, category_name, created_at, images_json
                FROM quiz_questions
                ORDER BY id DESC
            """).fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"[Analytics] get_all_quiz_questions error: {e}")
        return []


def save_quiz_question(question, option_a, option_b, option_c, option_d, correct_option,
                       explanation="", article_ref="", document_name="", image_url=None,
                       category_id=None, category_name="", images_json="[]"):
    """Save a new quiz question to DB."""
    try:
        conn = get_connection()
        c = conn.cursor()
        c.execute("""
            INSERT INTO quiz_questions
            (question, option_a, option_b, option_c, option_d, correct_option,
             explanation, article_ref, document_name, image_url, category_id, category_name, images_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (question, option_a, option_b, option_c, option_d, correct_option,
              explanation, article_ref, document_name, image_url, category_id, category_name, images_json))
        conn.commit()
        qid = c.lastrowid
        conn.close()
        return qid
    except Exception as e:
        print(f"[Analytics] save_quiz_question error: {e}")
        return None


def delete_quiz_question_by_id(qid):
    """Delete a quiz question by ID."""
    try:
        conn = get_connection()
        conn.execute("DELETE FROM quiz_questions WHERE id = ?", (qid,))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"[Analytics] delete_quiz_question error: {e}")
        return False


def update_quiz_question_by_id(qid, data):
    """Update a quiz question by ID."""
    try:
        conn = get_connection()
        conn.execute("""
            UPDATE quiz_questions
            SET question = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?,
                correct_option = ?, explanation = ?, article_ref = ?, document_name = ?,
                image_url = ?, category_id = ?, category_name = ?, images_json = ?
            WHERE id = ?
        """, (
            data.get('question', ''),
            data.get('option_a', ''),
            data.get('option_b', ''),
            data.get('option_c', ''),
            data.get('option_d', ''),
            data.get('correct_option', 'a'),
            data.get('explanation', ''),
            data.get('article_ref', ''),
            data.get('document_name', ''),
            data.get('image_url', None),
            data.get('category_id', None),
            data.get('category_name', ''),
            json.dumps(data.get('images', []), ensure_ascii=False) if data.get('images') else '[]',
            qid
        ))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"[Analytics] update_quiz_question error: {e}")
        return False


# ─── Category Management Functions ──────────────────────────────────

def get_all_quiz_categories():
    """Retrieve all quiz categories with question counts and browse cards."""
    try:
        conn = get_connection()
        rows = conn.execute("""
            SELECT c.id, c.name, c.description, c.icon, c.color, c.browse_cards, c.created_at,
                   COUNT(q.id) as question_count
            FROM quiz_categories c
            LEFT JOIN quiz_questions q ON q.category_id = c.id
            GROUP BY c.id
            ORDER BY c.id ASC
        """).fetchall()
        conn.close()
        results = []
        for r in rows:
            d = dict(r)
            try:
                raw_cards = d.get('browse_cards')
                d['browse_cards'] = json.loads(raw_cards) if raw_cards else []
            except Exception:
                d['browse_cards'] = []
            results.append(d)
        return results
    except Exception as e:
        print(f"[Analytics] get_all_quiz_categories error: {e}")
        return []


def save_quiz_category(name, description="", icon="fa-folder", color="#882D1B", browse_cards="[]"):
    """Create a new category with browse cards."""
    try:
        conn = get_connection()
        c = conn.cursor()
        cards_json = browse_cards if isinstance(browse_cards, str) else json.dumps(browse_cards, ensure_ascii=False)
        c.execute("""
            INSERT INTO quiz_categories (name, description, icon, color, browse_cards)
            VALUES (?, ?, ?, ?, ?)
        """, (name.strip(), description.strip(), icon.strip(), color.strip(), cards_json))
        conn.commit()
        cid = c.lastrowid
        conn.close()
        return cid
    except Exception as e:
        print(f"[Analytics] save_quiz_category error: {e}")
        return None


def update_quiz_category(cid, name, description="", icon="fa-folder", color="#882D1B", browse_cards="[]"):
    """Update an existing category with browse cards."""
    try:
        conn = get_connection()
        cards_json = browse_cards if isinstance(browse_cards, str) else json.dumps(browse_cards, ensure_ascii=False)
        conn.execute("""
            UPDATE quiz_categories
            SET name = ?, description = ?, icon = ?, color = ?, browse_cards = ?
            WHERE id = ?
        """, (name.strip(), description.strip(), icon.strip(), color.strip(), cards_json, cid))
        
        # Sync updated category name in quiz_questions
        conn.execute("""
            UPDATE quiz_questions
            SET category_name = ?
            WHERE category_id = ?
        """, (name.strip(), cid))

        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"[Analytics] update_quiz_category error: {e}")
        return False


def delete_quiz_category(cid, delete_questions=True):
    """Delete a category and automatically delete all questions associated with it."""
    try:
        conn = get_connection()
        if delete_questions:
            conn.execute("DELETE FROM quiz_questions WHERE category_id = ?", (cid,))
        else:
            conn.execute("UPDATE quiz_questions SET category_id = NULL, category_name = '' WHERE category_id = ?", (cid,))
        conn.execute("DELETE FROM quiz_categories WHERE id = ?", (cid,))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[Analytics] delete_quiz_category error: {e}")
        return False
