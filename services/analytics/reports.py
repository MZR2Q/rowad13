"""University-leadership comprehensive executive report."""
from datetime import datetime

from .db import get_connection

def get_university_comprehensive_report_db():
    """Generate professional, executive royal report for University Leadership."""
    try:
        conn = get_connection()

        # 1. High-level Summary Metrics
        total_students = conn.execute("SELECT COUNT(*) FROM student_progress").fetchone()[0]
        active_students = conn.execute("SELECT COUNT(*) FROM student_progress WHERE total_points > 0").fetchone()[0]
        total_points_distributed = conn.execute("SELECT COALESCE(SUM(total_points), 0) FROM student_progress").fetchone()[0]
        avg_score = conn.execute("SELECT COALESCE(AVG(total_points), 0) FROM student_progress WHERE total_points > 0").fetchone()[0]

        # 2. Workshop Attendance Breakdown (All 9 Workshops)
        workshop_stats = conn.execute("""
            SELECT workshop_id, workshop_title, day_number, COUNT(DISTINCT student_id) as attendees_count
            FROM student_workshop_attendance
            GROUP BY workshop_id, workshop_title, day_number
            ORDER BY day_number ASC, attendees_count DESC
        """).fetchall()

        # 3. QR Scan Station Breakdown
        qr_stats = conn.execute("""
            SELECT booth_code, booth_name, COUNT(DISTINCT student_id) as scan_count
            FROM student_qr_scans
            GROUP BY booth_code, booth_name
            ORDER BY scan_count DESC
        """).fetchall()

        # 4. Survey Feedback Metrics
        survey_count = conn.execute("SELECT COUNT(*) FROM survey_responses").fetchone()[0]
        avg_satisfaction = conn.execute("SELECT COALESCE(AVG(satisfaction_rating), 5) FROM survey_responses").fetchone()[0]
        avg_organization = conn.execute("SELECT COALESCE(AVG(organization_rating), 5) FROM survey_responses").fetchone()[0]
        avg_workshops = conn.execute("SELECT COALESCE(AVG(workshops_rating), 5) FROM survey_responses").fetchone()[0]
        avg_navigation = conn.execute("SELECT COALESCE(AVG(easy_navigation_rating), 5) FROM survey_responses").fetchone()[0]

        recent_feedback = conn.execute("""
            SELECT student_id, satisfaction_rating, positive_feedback, suggestions, created_at
            FROM survey_responses
            ORDER BY created_at DESC
            LIMIT 15
        """).fetchall()

        # 5. Honor Roll / Top Students
        top_students = conn.execute("""
            SELECT student_id, student_name, total_points, explore_points, quiz_points, campus_points, workshop_points, updated_at
            FROM student_progress
            ORDER BY total_points DESC, updated_at ASC
            LIMIT 20
        """).fetchall()

        # 6. Quiz Performance Summary
        quiz_attempts_total = conn.execute("SELECT COUNT(*) FROM quiz_attempts").fetchone()[0]
        quiz_avg_score = conn.execute("SELECT COALESCE(AVG(score_percent), 0) FROM quiz_attempts").fetchone()[0]
        quiz_perfect_scores = conn.execute("SELECT COUNT(*) FROM quiz_attempts WHERE score_percent >= 100").fetchone()[0]

        conn.close()

        return {
            'generated_at': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            'summary': {
                'total_students_registered': total_students,
                'active_participating_students': active_students,
                'total_points_awarded': round(total_points_distributed, 1),
                'average_points_per_student': round(avg_score, 1),
                'total_survey_responses': survey_count,
                'overall_satisfaction_stars': round(avg_satisfaction, 2),
                'organization_stars': round(avg_organization, 2),
                'workshops_stars': round(avg_workshops, 2),
                'navigation_stars': round(avg_navigation, 2),
                'quiz_attempts_total': quiz_attempts_total,
                'quiz_avg_score': round(quiz_avg_score, 1),
                'quiz_perfect_scores': quiz_perfect_scores
            },
            'workshops_breakdown': [dict(w) for w in workshop_stats],
            'qr_scans_breakdown': [dict(q) for q in qr_stats],
            'top_honor_students': [dict(s) for s in top_students],
            'recent_feedback': [dict(f) for f in recent_feedback]
        }
    except Exception as e:
        print(f"[Analytics] get_university_comprehensive_report_db error: {e}")
        return {}
