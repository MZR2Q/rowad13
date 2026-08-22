"""Official university student roster: lookup, add/update, seed sample data."""
from .db import get_connection

def add_or_update_official_student(student_id, national_id="", mobile_phone="", full_name="", college="", gender=""):
    """Insert or update official student record."""
    if not student_id:
        return False
    clean_id = str(student_id).strip()
    try:
        conn = get_connection()
        conn.execute("""
            INSERT INTO official_students (student_id, national_id, mobile_phone, full_name, college, gender, created_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(student_id) DO UPDATE SET
                national_id = excluded.national_id,
                mobile_phone = excluded.mobile_phone,
                full_name = excluded.full_name,
                college = excluded.college,
                gender = excluded.gender
        """, (clean_id, str(national_id or ''), str(mobile_phone or ''), str(full_name or f"طالب {clean_id}"), str(college or 'جامعة حفر الباطن'), str(gender or 'طالب')))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"[Analytics] add_or_update_official_student error: {e}")
        return False


def lookup_official_student(student_id):
    """Lookup official student details by student_id."""
    if not student_id:
        return None
    clean_id = str(student_id).strip()
    try:
        conn = get_connection()
        row = conn.execute("SELECT * FROM official_students WHERE student_id = ?", (clean_id,)).fetchone()
        conn.close()
        if row:
            return {
                'id': row['id'],
                'student_id': row['student_id'],
                'national_id': row['national_id'],
                'mobile_phone': row['mobile_phone'],
                'full_name': row['full_name'],
                'college': row['college'],
                'gender': row['gender'],
                'created_at': row['created_at']
            }
        return None
    except Exception as e:
        print(f"[Analytics] lookup_official_student error: {e}")
        return None


def get_all_official_students(limit=1000):
    """Get list of official registered students."""
    try:
        conn = get_connection()
        rows = conn.execute("SELECT * FROM official_students ORDER BY id ASC LIMIT ?", (limit,)).fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"[Analytics] get_all_official_students error: {e}")
        return []


def seed_default_official_students():
    """Seed initial official sample students for verification and testing."""
    samples = [
        ("2270005709", "1102938475", "0506968177", "سيف مروي الشمري", "كلية علوم وهندسة الحاسب الآلي", "ذكر"),
        ("2270001234", "1098765432", "0509876543", "سارة خالد المطيري", "كلية إدارة الأعمال", "أنثى"),
        ("2270005678", "1122334455", "0543219876", "فهد ناصر الظفيري", "كلية الهندسة", "ذكر"),
        ("2270009012", "1144556677", "0567891234", "نورة سعود الحربي", "كلية العلوم التطبيقية", "أنثى"),
        ("2270003456", "1188990011", "0534567890", "سلطان إبراهيم الخالدي", "كلية التربية", "ذكر")
    ]
    try:
        conn = get_connection()
        for stu in samples:
            conn.execute("""
                INSERT OR REPLACE INTO official_students (student_id, national_id, mobile_phone, full_name, college, gender)
                VALUES (?, ?, ?, ?, ?, ?)
            """, stu)
        conn.commit()
        print(f"[Analytics] Seeded {len(samples)} official 227-prefix students.")
        conn.close()
    except Exception as e:
        print(f"[Analytics] seed_default_official_students error: {e}")


# ─── Master Interactive Journey Questions Configuration ─────────────────
# Now loaded from DB via get_journey_questions_from_db() instead of hardcoded
