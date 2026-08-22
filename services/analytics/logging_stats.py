"""Visit/question/UI-event logging and admin dashboard stats."""
import re
from datetime import date, timedelta
from collections import Counter

from .db import get_connection
from .quiz import get_all_quiz_attempts

STOPWORDS = {
    "وش", "ما", "متى", "كيف", "هل", "اذا", "إذا", "لو",
    "في", "من", "على", "عن", "إن", "ان", "لي", "لو", "او", "أو",
    "انا", "أبي", "ابي", "بي", "لك", "له", "هو", "هي",
    "يعني", "يصير", "مسموح", "ممكن", "ابغى", "ابغا",
    "الله", "والله", "يارب", "الي", "اللي", "كان", "كانت",
    "هذا", "هذه", "ذلك", "تلك", "هناك", "فيه", "فيها",
    "عندي", "عندك", "عندهم", "بعد", "قبل", "اذا", "الان",
    "the", "is", "a", "an", "i", "my", "what", "how", "when"
}
def log_visit(session_id, ip_address, user_agent, path, referrer):
    """Log a page visit."""
    try:
        conn = get_connection()
        conn.execute(
            "INSERT INTO visits (session_id, ip_address, user_agent, path, referrer) VALUES (?, ?, ?, ?, ?)",
            (session_id, ip_address, user_agent, path, referrer)
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[Analytics] log_visit error: {e}")


def log_question(session_id, question, normalized_question, answer, sources,
                 selected_document_id, intent, used_gemini, used_fallback, response_time_ms):
    """Log a chatbot question with its answer and sources."""
    try:
        conn = get_connection()
        answer_preview = str(answer or '')[:300]
        c = conn.cursor()
        c.execute(
            """INSERT INTO question_logs
               (session_id, question, normalized_question, answer_preview,
                selected_document_id, intent, used_gemini, used_fallback, response_time_ms)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (session_id, question, normalized_question, answer_preview,
             selected_document_id, intent,
             1 if used_gemini else 0,
             1 if used_fallback else 0,
             response_time_ms)
        )
        question_log_id = c.lastrowid

        # Log each source hit
        for src in (sources or []):
            c.execute(
                """INSERT INTO source_hits
                   (question_log_id, session_id, unique_id, document_id, document_name, source_type, label)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (question_log_id, session_id,
                 src.get('unique_id', ''),
                 src.get('document_id', ''),
                 src.get('document_name', ''),
                 src.get('type', 'article'),
                 src.get('label', ''))
            )

        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[Analytics] log_question error: {e}")


def log_source_click(session_id, unique_id, document_id, source_type, label):
    """Log a user click on a source chip."""
    try:
        conn = get_connection()
        conn.execute(
            "INSERT INTO source_clicks (session_id, unique_id, document_id, source_type, label) VALUES (?, ?, ?, ?, ?)",
            (session_id, unique_id, document_id, source_type, label)
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[Analytics] log_source_click error: {e}")


def log_ui_event(session_id, event_name, event_value=None):
    """Log a UI interaction event."""
    try:
        conn = get_connection()
        conn.execute(
            "INSERT INTO ui_events (session_id, event_name, event_value) VALUES (?, ?, ?)",
            (session_id, event_name, event_value)
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[Analytics] log_ui_event error: {e}")

# ─── Admin Dashboard Stats ─────────────────────────────────
def get_dashboard_stats():
    """Gather all statistics for the admin dashboard."""
    try:
        conn = get_connection()
        c = conn.cursor()
        today = date.today().isoformat()

        total_visits   = c.execute("SELECT COUNT(*) FROM visits").fetchone()[0]
        today_visits   = c.execute("SELECT COUNT(*) FROM visits WHERE DATE(created_at) = ?", (today,)).fetchone()[0]
        total_questions = c.execute("SELECT COUNT(*) FROM question_logs").fetchone()[0]
        today_questions = c.execute("SELECT COUNT(*) FROM question_logs WHERE DATE(created_at) = ?", (today,)).fetchone()[0]
        gemini_count   = c.execute("SELECT COUNT(*) FROM question_logs WHERE used_gemini = 1").fetchone()[0]
        fallback_count = c.execute("SELECT COUNT(*) FROM question_logs WHERE used_fallback = 1").fetchone()[0]
        source_clicks_count = c.execute("SELECT COUNT(*) FROM source_clicks").fetchone()[0]

        avg_ms_row = c.execute("SELECT AVG(response_time_ms) FROM question_logs WHERE response_time_ms IS NOT NULL").fetchone()
        avg_response_ms = round(avg_ms_row[0] or 0)

        doc_usage = c.execute("""
            SELECT document_name, COUNT(*) AS total
            FROM source_hits
            GROUP BY document_id, document_name
            ORDER BY total DESC
        """).fetchall()

        top_sources = c.execute("""
            SELECT label, document_name, source_type, COUNT(*) AS total
            FROM source_hits
            GROUP BY unique_id, label, document_name, source_type
            ORDER BY total DESC
            LIMIT 10
        """).fetchall()

        top_clicked = c.execute("""
            SELECT label, document_id, source_type, COUNT(*) AS total
            FROM source_clicks
            GROUP BY unique_id, label, document_id, source_type
            ORDER BY total DESC
            LIMIT 10
        """).fetchall()

        recent_questions = c.execute("""
            SELECT question, selected_document_id, used_gemini, used_fallback,
                   response_time_ms, created_at
            FROM question_logs
            ORDER BY created_at DESC
            LIMIT 20
        """).fetchall()

        all_nq = c.execute("SELECT normalized_question FROM question_logs WHERE normalized_question IS NOT NULL").fetchall()
        word_counter = Counter()
        for row in all_nq:
            words = re.findall(r'[\u0600-\u06ffa-z]+', str(row[0]).lower())
            for w in words:
                if len(w) > 1 and w not in STOPWORDS:
                    word_counter[w] += 1
        top_words = word_counter.most_common(20)

        daily_trend_raw = c.execute("""
            SELECT DATE(created_at) AS day, COUNT(*) AS total
            FROM question_logs
            WHERE DATE(created_at) >= DATE('now', '-6 days')
            GROUP BY day
        """).fetchall()
        
        trend_dict = {row['day']: row['total'] for row in daily_trend_raw}
        base_date = date.today()
        daily_trend_complete = []
        for i in range(6, -1, -1):
            d_str = (base_date - timedelta(days=i)).isoformat()
            daily_trend_complete.append({'day': d_str, 'total': trend_dict.get(d_str, 0)})

        total_quiz_attempts = c.execute("SELECT COUNT(*) FROM quiz_attempts").fetchone()[0]
        total_students_count = c.execute("SELECT COUNT(DISTINCT student_id) FROM (SELECT student_id FROM quiz_attempts UNION SELECT student_id FROM student_progress)").fetchone()[0]

        conn.close()

        recent_quiz_attempts = get_all_quiz_attempts(limit=50)

        return {
            "total_visits":        total_visits,
            "today_visits":        today_visits,
            "total_questions":     total_questions,
            "today_questions":     today_questions,
            "total_quiz_attempts": total_quiz_attempts,
            "total_students_count": total_students_count,
            "recent_quiz_attempts": recent_quiz_attempts,
            "gemini_count":        gemini_count,
            "fallback_count":      fallback_count,
            "avg_response_ms":     avg_response_ms,
            "source_clicks_count": source_clicks_count,
            "doc_usage":           [dict(r) for r in doc_usage],
            "top_sources":         [dict(r) for r in top_sources],
            "top_clicked":         [dict(r) for r in top_clicked],
            "recent_questions":    [dict(r) for r in recent_questions],
            "top_words":           top_words,
            "daily_trend":         daily_trend_complete,
        }

    except Exception as e:
        print(f"[Analytics] get_dashboard_stats error: {e}")
        return {}
