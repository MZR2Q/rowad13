"""Low-level SQLite connection, schema init, and generic key/value settings."""
import sqlite3
import os
import json
import re
import base64 as _base64

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
DB_PATH = os.path.join(_PROJECT_ROOT, 'instance', 'analytics.db')
PROOF_DIR = os.path.join(_PROJECT_ROOT, 'static', 'uploads', 'proofs')

# ─── In-memory cache for admin directory (refreshes every 30s) ───────────────
_MIME_EXT = {
    'image/png': '.png', 'image/jpeg': '.jpg', 'image/jpg': '.jpg',
    'image/webp': '.webp', 'image/gif': '.gif'
}

def _strip_base64_from_quiz(quiz_dict, student_id):
    """
    Recursively replace embedded base64 dataUrls with disk file URLs.
    Deduplicates: identical base64 content reuses the same file (no duplicates).
    Returns (cleaned_dict, files_saved_count).
    """
    if not isinstance(quiz_dict, dict):
        return quiz_dict, 0
    saved = [0]
    _b64_to_url = {}  # Dedup cache: base64 prefix → file_url

    def _walk(d):
        if not isinstance(d, dict):
            return d
        out = {}
        for k, v in d.items():
            if k == 'dataUrl' and isinstance(v, str) and v.startswith('data:image'):
                # Check dedup cache first (use first 200 chars as key)
                b64_key = v[:200]
                if b64_key in _b64_to_url:
                    out[k] = _b64_to_url[b64_key]
                    if not d.get('url'):
                        out['url'] = _b64_to_url[b64_key]
                    continue
                m = re.match(r'data:([^;]+);base64,(.+)', v, re.DOTALL)
                if m:
                    try:
                        mime = m.group(1).strip()
                        img_bytes = _base64.b64decode(m.group(2).strip())
                        ext = _MIME_EXT.get(mime, '.png')
                        os.makedirs(PROOF_DIR, exist_ok=True)
                        ptype = d.get('type', 'proof')
                        safe_sid = re.sub(r'[^a-zA-Z0-9_-]', '', str(student_id))
                        safe_type = re.sub(r'[^a-zA-Z0-9_-]', '', str(ptype)).lower()
                        idx = saved[0]
                        fname = f"{safe_sid}_{safe_type}_first_{idx:04d}{ext}"
                        fpath = os.path.join(PROOF_DIR, fname)
                        if not os.path.exists(fpath):
                            with open(fpath, 'wb') as f:
                                f.write(img_bytes)
                        file_url = f"/static/uploads/proofs/{fname}"
                        saved[0] += 1
                        _b64_to_url[b64_key] = file_url  # Cache for dedup
                        out[k] = file_url
                        if not d.get('url'):
                            out['url'] = file_url
                    except Exception:
                        out[k] = ''  # drop broken base64
                else:
                    out[k] = ''
            elif isinstance(v, dict):
                out[k] = _walk(v)
            elif isinstance(v, list):
                out[k] = [_walk(i) if isinstance(i, dict) else i for i in v]
            else:
                out[k] = v
        return out

    cleaned = _walk(quiz_dict)
    return cleaned, saved[0]
def get_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=30.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    # Ensure WAL mode and memory pragmas on every connection
    try:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        conn.execute("PRAGMA busy_timeout=30000;")
        conn.execute("PRAGMA temp_store=MEMORY;")
    except Exception:
        pass
    return conn

def init_analytics_db():
    """Initialize the analytics database, create tables and high-concurrency indexes."""
    try:
        conn = get_connection()
        c = conn.cursor()

        c.execute("PRAGMA journal_mode=WAL;")
        c.execute("PRAGMA synchronous=NORMAL;")
        c.execute("PRAGMA busy_timeout=30000;")
        c.execute("PRAGMA cache_size=-64000;")

        c.execute("""
            CREATE TABLE IF NOT EXISTS visits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                ip_address TEXT,
                user_agent TEXT,
                path TEXT,
                referrer TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        c.execute("""
            CREATE TABLE IF NOT EXISTS question_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                question TEXT NOT NULL,
                normalized_question TEXT,
                answer_preview TEXT,
                selected_document_id TEXT,
                intent TEXT,
                used_gemini INTEGER DEFAULT 0,
                used_fallback INTEGER DEFAULT 0,
                response_time_ms INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        c.execute("""
            CREATE TABLE IF NOT EXISTS source_hits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question_log_id INTEGER,
                session_id TEXT,
                unique_id TEXT NOT NULL,
                document_id TEXT NOT NULL,
                document_name TEXT,
                source_type TEXT,
                label TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (question_log_id) REFERENCES question_logs(id)
            )
        """)

        c.execute("""
            CREATE TABLE IF NOT EXISTS source_clicks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                unique_id TEXT NOT NULL,
                document_id TEXT,
                source_type TEXT,
                label TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        c.execute("""
            CREATE TABLE IF NOT EXISTS ui_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                event_name TEXT NOT NULL,
                event_value TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ─── System Global Settings & Epoch Tracker ───
        c.execute("""
            CREATE TABLE IF NOT EXISTS system_settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ─── Quiz Tables ──────────────────────────────
        c.execute("""
            CREATE TABLE IF NOT EXISTS quiz_categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                icon TEXT DEFAULT 'fa-folder',
                color TEXT DEFAULT '#882D1B',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        c.execute("""
            CREATE TABLE IF NOT EXISTS quiz_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question TEXT NOT NULL,
                option_a TEXT NOT NULL,
                option_b TEXT NOT NULL,
                option_c TEXT NOT NULL,
                option_d TEXT NOT NULL,
                correct_option TEXT NOT NULL,
                explanation TEXT,
                article_ref TEXT,
                document_name TEXT,
                category_id INTEGER,
                category_name TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        c.execute("""
            CREATE TABLE IF NOT EXISTS quiz_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT NOT NULL,
                student_name TEXT NOT NULL,
                total_questions INTEGER DEFAULT 5,
                correct_answers INTEGER DEFAULT 0,
                score_percent REAL DEFAULT 0,
                time_taken_seconds INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ─── Student Unified Progress & Points Table ──────────────────────────
        c.execute("""
            CREATE TABLE IF NOT EXISTS student_progress (
                student_id TEXT PRIMARY KEY,
                student_name TEXT,
                explore_points REAL DEFAULT 0,
                quiz_points REAL DEFAULT 0,
                campus_points REAL DEFAULT 0,
                workshop_points REAL DEFAULT 0,
                total_points REAL DEFAULT 0,
                stations_completed_count INTEGER DEFAULT 0,
                qr_scans_count INTEGER DEFAULT 0,
                quiz_answers_count INTEGER DEFAULT 0,
                workshops_completed_count INTEGER DEFAULT 0,
                docs_explored_count INTEGER DEFAULT 0,
                explored_docs_json TEXT DEFAULT '{}',
                quiz_data_json TEXT DEFAULT '{}',
                campus_data_json TEXT DEFAULT '{}',
                workshops_data_json TEXT DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ─── Relational Student Activity Log (Zero-loss atomic tracking) ──────
        c.execute("""
            CREATE TABLE IF NOT EXISTS student_activities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT NOT NULL,
                activity_type TEXT NOT NULL,
                item_id TEXT NOT NULL,
                item_title TEXT,
                points_earned REAL DEFAULT 0,
                metadata_json TEXT DEFAULT '{}',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ─── Relational QR Code Scans Table ──────────────────────────────────
        c.execute("""
            CREATE TABLE IF NOT EXISTS student_qr_scans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT NOT NULL,
                booth_code TEXT NOT NULL,
                booth_name TEXT,
                points_earned REAL DEFAULT 10,
                scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, booth_code)
            )
        """)

        # ─── Relational Workshop Attendance & Completion Table ────────────────
        c.execute("""
            CREATE TABLE IF NOT EXISTS student_workshop_attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT NOT NULL,
                workshop_id TEXT NOT NULL,
                workshop_title TEXT NOT NULL,
                day_number INTEGER DEFAULT 1,
                points_earned REAL DEFAULT 10,
                attended_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, workshop_id)
            )
        """)

        # ─── Relational Survey & Feedback Responses Table ─────────────────────
        c.execute("""
            CREATE TABLE IF NOT EXISTS survey_responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT NOT NULL,
                student_name TEXT,
                satisfaction_rating INTEGER DEFAULT 5,
                organization_rating INTEGER DEFAULT 5,
                workshops_rating INTEGER DEFAULT 5,
                easy_navigation_rating INTEGER DEFAULT 5,
                positive_feedback TEXT,
                suggestions TEXT,
                points_awarded REAL DEFAULT 10,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ─── Official University Students Roster Table ───────────────────────
        c.execute("""
            CREATE TABLE IF NOT EXISTS official_students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                national_id TEXT,
                mobile_phone TEXT,
                student_id TEXT UNIQUE NOT NULL,
                full_name TEXT NOT NULL,
                college TEXT,
                gender TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ─── Relational Video Views & Watching Tracker Table ─────────────────
        c.execute("""
            CREATE TABLE IF NOT EXISTS student_video_views (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT NOT NULL,
                student_name TEXT,
                video_index INTEGER DEFAULT 0,
                video_url TEXT,
                video_caption TEXT,
                watched_seconds REAL DEFAULT 0,
                video_duration REAL DEFAULT 0,
                completion_percent REAL DEFAULT 0,
                is_completed INTEGER DEFAULT 0,
                last_watched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, video_index)
            )
        """)

        # ─── Station Videos Table (Admin-managed videos linked to virtual stations) ──
        c.execute("""
            CREATE TABLE IF NOT EXISTS station_videos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                url TEXT NOT NULL,
                station_num INTEGER DEFAULT NULL,
                sort_order INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # High-Performance Indexes for 6,000+ Concurrent Students
        c.execute("CREATE INDEX IF NOT EXISTS idx_official_students_stu ON official_students(student_id);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_official_students_nat ON official_students(national_id);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_student_video_views_stu ON student_video_views(student_id);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_student_video_views_idx ON student_video_views(video_index);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student ON quiz_attempts(student_id);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_quiz_attempts_score ON quiz_attempts(score_percent DESC, time_taken_seconds ASC);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_quiz_attempts_created ON quiz_attempts(created_at DESC);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_student_progress_pts ON student_progress(total_points DESC);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_quiz_questions_cat ON quiz_questions(category_id);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_student_activities_stu ON student_activities(student_id, activity_type);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_student_qr_stu ON student_qr_scans(student_id);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_student_ws_stu ON student_workshop_attendance(student_id);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_student_ws_id ON student_workshop_attendance(workshop_id);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_survey_stu ON survey_responses(student_id);")

        # Dynamic column migrations if tables existed
        for col_def in [
            ("workshop_points", "REAL DEFAULT 0"),
            ("stations_completed_count", "INTEGER DEFAULT 0"),
            ("qr_scans_count", "INTEGER DEFAULT 0"),
            ("quiz_answers_count", "INTEGER DEFAULT 0"),
            ("workshops_completed_count", "INTEGER DEFAULT 0"),
            ("docs_explored_count", "INTEGER DEFAULT 0"),
            ("workshops_data_json", "TEXT DEFAULT '{}'")
        ]:
            try:
                c.execute(f"ALTER TABLE student_progress ADD COLUMN {col_def[0]} {col_def[1]}")
            except Exception:
                pass

        # Ensure image_url, category_id, category_name columns exist in quiz_questions
        try:
            c.execute("ALTER TABLE quiz_questions ADD COLUMN image_url TEXT")
        except Exception:
            pass

        try:
            c.execute("ALTER TABLE quiz_questions ADD COLUMN category_id INTEGER")
        except Exception:
            pass

        try:
            c.execute("ALTER TABLE quiz_questions ADD COLUMN category_name TEXT")
        except Exception:
            pass

        # Journey quiz columns: link quiz_questions to journey slides/stations
        for jcol in [
            ("slide_number", "INTEGER"),       # slide index in journey (4,5,6,12,15...)
            ("station_number", "INTEGER"),      # station 1-5
            ("is_journey", "INTEGER DEFAULT 0"), # 1=journey question, 0=regular quiz
            ("images_json", "TEXT DEFAULT '[]'"), # JSON array of {url, caption} for multiple images
        ]:
            try:
                c.execute(f"ALTER TABLE quiz_questions ADD COLUMN {jcol[0]} {jcol[1]}")
            except Exception:
                pass

        # Ensure wrong_answers, category_name, answers_detail_json columns exist in quiz_attempts
        try:
            c.execute("ALTER TABLE quiz_attempts ADD COLUMN wrong_answers INTEGER DEFAULT 0")
        except Exception:
            pass

        try:
            c.execute("ALTER TABLE quiz_attempts ADD COLUMN category_name TEXT")
        except Exception:
            pass

        try:
            c.execute("ALTER TABLE quiz_attempts ADD COLUMN answers_detail_json TEXT DEFAULT '[]'")
        except Exception:
            pass

        # Check if browse_cards column exists in quiz_categories
        cat_cols = [r[1] for r in c.execute("PRAGMA table_info(quiz_categories)").fetchall()]
        if 'browse_cards' not in cat_cols:
            c.execute("ALTER TABLE quiz_categories ADD COLUMN browse_cards TEXT DEFAULT '[]'")

        # Seed default categories if empty or missing
        existing_cat_names = set(r[0] for r in c.execute("SELECT name FROM quiz_categories").fetchall())
        
        bb_cards_json = json.dumps([
            {"title": "1. تسجيل الدخول وإثبات الحساب", "desc": "يتم الدخول بالرقم الجامعي الموحد وكلمة المرور الخاصة بك مع توثيق الحساب بالصورة.", "icon": "fa-key"},
            {"title": "2. الفصول الافتراضية والتفاعل المباشر", "desc": "حضور المحاضرات المباشرة عبر Blackboard Collaborate والتفاعل الفوري مع الدكتور.", "icon": "fa-display"},
            {"title": "3. تسليم التكليفات والواجبات الدراسية", "desc": "رفع الواجبات والمشاريع الإلكترونية عبر رابط الموعد المحدد والحصول على التقييم.", "icon": "fa-file-arrow-up"},
            {"title": "4. أداء الاختبارات الإلكترونية (Quizzes)", "desc": "إجراء الاختبارات القصيرة والنصفيّة أونلاين ببيئة آمنة مع رصد التوقيت التلقائي.", "icon": "fa-spell-check"},
            {"title": "5. مركز التقديرات ومتابعة الدرجات", "desc": "متابعة درجات أعمال السنة والنقاط التراكمية في كل مادة أولاً بأول بكل يسر.", "icon": "fa-square-poll-vertical"},
            {"title": "6. لوحة النقاشات والإعلانات الرسمية", "desc": "التواصل مع دكاترة المواد وحلقات النقاش والاطلاع على التنبيهات الجامعية الهامة.", "icon": "fa-comments"}
        ], ensure_ascii=False)

        sr_cards_json = json.dumps([
            {"title": "1. تسجيل الدخول والإثبات الأكاديمي", "desc": "تأكيد دخول حسابك بالرقم الجامعي الموحد وإرفاق صورة شاشة لتأكيد نشاط الحساب.", "icon": "fa-id-card-clip"},
            {"title": "2. السجل الأكاديمي والمعدل (GPA)", "desc": "عرض تفصيلي لكشف الدرجات لكافة الفصول والساعات المكتسبة وحساب المعدل بدقة.", "icon": "fa-file-invoice-dollar"},
            {"title": "3. تسجيل المقررات وتثبيت الجدول", "desc": "إمكانية الحذف والإضافة للمواد، تعديل الشعب الدراسية وطباعة الجدول الأكاديمي.", "icon": "fa-calendar-week"},
            {"title": "4. طلبات الاعتذار وتأجيل الدراسة", "desc": "تقديم طلبات الاعتذار عن الفصل أو مقرر، وطلبات تأجيل الدراسة نظامياً.", "icon": "fa-arrows-split-up-and-left"},
            {"title": "5. التحويل الداخلي بين التخصصات", "desc": "تقديم وتتبع طلبات التحويل الإلكتروني بين الكليات وفق الشروط والمواعيد الرسمية.", "icon": "fa-repeat"},
            {"title": "6. الإفادات ووثائق التخرج الرسمية", "desc": "طباعة الإفادات الطلابية ومتابعة التخرج والتحقق من التوصيات الصادرة من العمادة.", "icon": "fa-certificate"}
        ], ensure_ascii=False)

        default_categories = [
            ("اللوائح والأنظمة الأكاديمية", "شروط الدراسة والإنذارات ونسب الحرمان والمواد الأكاديمية", "fa-book-open", "#882D1B", "[]"),
            ("التقويم الأكاديمي والتواريخ", "مواعيد الفصول والاعتذارات والتقويم الأكاديمي لجامعة حفر الباطن", "fa-calendar-days", "#BC8859", "[]"),
            ("خدمات شؤون الطلاب والسُلف", "السُلف والإعانات والمكافآت والرعاية الطلابية", "fa-hand-holding-heart", "#607976", "[]"),
            ("القبول والتسجيل والتحويل", "خطوات التحويل بين التخصصات والقبول والإضافة والحذف", "fa-user-graduate", "#868185", "[]"),
            ("البريد الجامعي والهوية المؤسسية", "تفعيل البريد الرسمي الموحد وضوابط الهوية للمؤسسة", "fa-envelope", "#7D321D", "[]"),
            ("نظام البلاك بورد", "منصة التعلم الإلكتروني ومتابعة المقررات والواجبات والاختبارات", "fa-laptop-code", "#2563EB", bb_cards_json),
            ("نظام سجلات الطلاب", "البوابة الأكاديمية لمتابعة السجل الدراسي وتجهيز الجدول والطلبات", "fa-folder-open", "#059669", sr_cards_json)
        ]
        for name, desc, icon, color, bcards in default_categories:
            if name not in existing_cat_names:
                c.execute("INSERT INTO quiz_categories (name, description, icon, color, browse_cards) VALUES (?, ?, ?, ?, ?)", (name, desc, icon, color, bcards))
            else:
                # Update browse_cards if currently empty
                c.execute("UPDATE quiz_categories SET browse_cards = ? WHERE name = ? AND (browse_cards IS NULL OR browse_cards = '' OR browse_cards = '[]')", (bcards, name))
        
        conn.commit()

        # Fetch category IDs map
        cat_rows = c.execute("SELECT id, name FROM quiz_categories").fetchall()
        cat_map = {r['name']: r['id'] for r in cat_rows}

        # Seed the 6 questions for Blackboard and Student Records
        existing_qs = set(r[0] for r in c.execute("SELECT question FROM quiz_questions").fetchall())

        new_questions = [
            # ─── أسئلة قسم نظام البلاك بورد ───
            (
                "يرجى إرفاق صورة شاشة (Screenshot) تُثبت تسجيل دخولك في نظام التعلم الإلكتروني (البلاك بورد).",
                "تم إرفاق صورة إثبات تسجيل الدخول بنجاح 📸",
                "تعذر الإرفاق حالياً",
                "لا أملك حساباً في البلاك بورد",
                "تأجيل الإرفاق",
                "a",
                "ممتاز! إرفاق صورة الدخول يضمن توثيق حسابك النشط في نظام البلاك بورد وتفعيل الخدمات.",
                "إثبات الدخول",
                "دليل البلاك بورد",
                cat_map.get("نظام البلاك بورد"),
                "نظام البلاك بورد"
            ),
            (
                "ما هي إحدى الميزات والوظائف الرئيسية لنظام البلاك بورد (Blackboard)؟",
                "متابعة المحاضرات الإلكترونية وتسليم التكليفات والواجبات الدراسية",
                "حجز تذاكر الطيران والمواصلات",
                "تعديل التخصص الأكاديمي رسمياً",
                "طلب استخراج جواز السفر",
                "a",
                "نظام البلاك بورد يُمكّن الطلاب من متابعة المحاضرات، حل الواجبات، والاستفادة من المصادر التعليمية.",
                "دليل الخدمات الرقمية",
                "دليل البلاك بورد",
                cat_map.get("نظام البلاك بورد"),
                "نظام البلاك بورد"
            ),
            (
                "فيما يُستخدم نظام البلاك بورد أيضاً خلال الفصل الدراسي؟",
                "أداء الاختبارات الإلكترونية القصيرة والاطلاع على درجات الأعمال الفصلية",
                "تقديم طلب السكن الجامعي",
                "صرف السُلف المالية الطارئة",
                "شراء الوجبات المدرسية",
                "a",
                "تُجرى الاختبارات القصيرة (Quizzes) والاستئناسية من خلال البلاك بورد مع إتاحة رصد درجات أعمال السنة.",
                "دليل الاختبارات الإلكترونية",
                "دليل البلاك بورد",
                cat_map.get("نظام البلاك بورد"),
                "نظام البلاك بورد"
            ),

            # ─── أسئلة قسم نظام سجلات الطلاب ───
            (
                "يرجى إرفاق صورة شاشة (Screenshot) تُثبت تسجيل دخولك في نظام سجلات الطلاب (البوابة الأكاديمية).",
                "تم إرفاق صورة إثبات دخول البوابة الأكاديمية بنجاح 📸",
                "لم أستطع الدخول حالياً",
                "لا أذكر الرقم الجامعي",
                "تأجيل الخطوة",
                "a",
                "أحسنت! إثبات الدخول للبوابة الأكاديمية يوثق سجلاتك ومسيرتك الجامعية بوضوح.",
                "إثبات الدخول",
                "سجلات الطلاب",
                cat_map.get("نظام سجلات الطلاب"),
                "نظام سجلات الطلاب"
            ),
            (
                "ما هي الوظيفة الأساسية لنظام سجلات الطلاب (البوابة الأكاديمية)؟",
                "استعراض السجل الأكاديمي، والمعدل التراكمي، وتثبيت وتعديل الجدول الدراسي",
                "تشغيل الألعاب التنافسية الفردية",
                "متابعة أخبار الرياضة العالمية",
                "شراء الأجهزة الإلكترونية",
                "a",
                "تُعد البوابة الأكاديمية المنصة الرسمية لمتابعة السجل الأكاديمي والتعديل على الجدول الدراسي والمعدل.",
                "قواعد القبول والتسجيل",
                "سجلات الطلاب",
                cat_map.get("نظام سجلات الطلاب"),
                "نظام سجلات الطلاب"
            ),
            (
                "أي من المعاملات الطلابية التالية يتم تقديمها وإدارتها عبر نظام سجلات الطلاب؟",
                "تقديم طلبات الاعتذار عن الفصل، وتأجيل الدراسة، والتحويل بين التخصصات",
                "طلب خدمة الإسعافات الأولية",
                "تأجير الخزائن الطلابية",
                "طباعة ملصقات الأندية",
                "a",
                "يُتيح نظام السجلات تقديم الطلبات الأكاديمية الرسمية كالاعتذار والتحويل والحذف إلكترونياً.",
                "الخدمات الإلكترونية",
                "سجلات الطلاب",
                cat_map.get("نظام سجلات الطلاب"),
                "نظام سجلات الطلاب"
            )
        ]

        for q_tuple in new_questions:
            if q_tuple[0] not in existing_qs:
                c.execute("""
                    INSERT INTO quiz_questions
                    (question, option_a, option_b, option_c, option_d, correct_option,
                     explanation, article_ref, document_name, category_id, category_name)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, q_tuple)

        # Auto-heal any unassigned category IDs for default questions
        cat_academic_id = cat_map.get("اللوائح والأنظمة الأكاديمية")
        cat_calendar_id = cat_map.get("التقويم الأكاديمي والتواريخ")
        cat_reg_id = cat_map.get("القبول والتسجيل والتحويل")

        if cat_academic_id:
            c.execute("UPDATE quiz_questions SET category_id = ?, category_name = 'اللوائح والأنظمة الأكاديمية' WHERE (category_id IS NULL OR category_id = '') AND (id IN (2, 4, 5, 6) OR question LIKE '%المخالفات الأكاديمية%' OR question LIKE '%المعدل التراكمي%')", (cat_academic_id,))
        if cat_calendar_id:
            c.execute("UPDATE quiz_questions SET category_id = ?, category_name = 'التقويم الأكاديمي والتواريخ' WHERE (category_id IS NULL OR category_id = '') AND (id = 3 OR question LIKE '%الفصل الدراسي%')", (cat_calendar_id,))
        if cat_reg_id:
            c.execute("UPDATE quiz_questions SET category_id = ?, category_name = 'القبول والتسجيل والتحويل' WHERE (category_id IS NULL OR category_id = '') AND (id = 1 OR question LIKE '%شهادة الثانوية%')", (cat_reg_id,))

        # ═══ Seed Journey Quiz Questions (13 MCQ questions for the student journey) ═══
        existing_journey = set(
            r[0] for r in c.execute(
                "SELECT slide_number FROM quiz_questions WHERE is_journey = 1 AND slide_number IS NOT NULL"
            ).fetchall()
        )

        journey_questions_seed = [
            # Station 1: عن الجامعة (slides 4, 5, 6)
            (4, 1, "في أي سنة هجرية تأسست جامعة حفر الباطن؟",
             "1435هـ", "1420هـ", "1445هـ", "", "a",
             "تأسست عام 1435هـ (2014م) بالمرسوم الملكي رقم (20937).", "المرسوم التأسيسي للجامعة", "عن الجامعة"),
            (5, 1, "كم عدد كليات جامعة حفر الباطن؟",
             "10 كليات", "5 كليات", "15 كلية", "", "a",
             "تضم الجامعة 10 كليات في مختلف التخصصات.", "دليل كليات الجامعة", "عن الجامعة"),
            (6, 1, "ما اللونان الرسميان المعتمدان في الهوية البصرية للجامعة؟",
             "اللون القرمزي والذهبي الرملي (#872A08 | #EFC68F)", "الأزرق والرمادي (#1E40AF | #93C5FD)", "الأخضر الزمردي والنعناعي (#047857 | #A7F3D0)", "", "a",
             "اللونان الرسميان المعتمدان هما: #872A08 (القرمزي) و #EFC68F (الذهبي الرملي).", "دليل الهوية البصرية للجامعة", "عن الجامعة"),

            # Station 2: الأنظمة التقنية (slide 12 — slides 10,11 are proof uploads)
            (12, 2, "أين يقدّم الطالب طلب التحويل بين التخصصات؟",
             "عبر البوابة الأكاديمية إلكترونياً", "بزيارة الكلية شخصياً فقط", "بالاتصال الهاتفي", "", "a",
             "طلبات التحويل تُقدم إلكترونياً عبر البوابة الأكاديمية.", "دليل الخدمات الإلكترونية", "الأنظمة التقنية"),

            # Station 3: حقوقك وواجباتك (slides 15, 16, 17)
            (15, 3, "إذا تجاوز غياب الطالب 25% من المحاضرات، ماذا يحصل؟",
             "لا يحصل شيء", "يُحرم من دخول الاختبار النهائي", "يحصل على إنذار فقط", "", "b",
             "تجاوز 25% غياب يعني الحرمان من الاختبار النهائي.", "لائحة الدراسة والاختبارات", "حقوقك وواجباتك"),
            (16, 3, "ما عقوبة الغش في الاختبارات حسب لائحة الانضباط؟",
             "إنذار خطي فقط", "رسوب في المقرر وتسجيل المخالفة", "لا توجد عقوبة", "", "b",
             "الغش مخالفة من الدرجة الثانية عقوبتها الرسوب في المقرر وتسجيل المخالفة.", "لائحة الانضباط الطلابي", "حقوقك وواجباتك"),
            (17, 3, "هل يحق للطالب التظلم من قرار تأديبي؟",
             "نعم، خلال 15 يوماً من إبلاغه", "لا يحق له التظلم", "فقط بعد سنة", "", "a",
             "يحق التظلم خلال 15 يوماً من تاريخ الإبلاغ بالقرار.", "لائحة الانضباط الطلابي", "حقوقك وواجباتك"),

            # Station 4: القبول والتسجيل (slides 21, 22, 23)
            (21, 4, "من أين يقدّم الطالب طلب الاعتذار عن الفصل الدراسي؟",
             "من البوابة الأكاديمية (سجلات الطلاب)", "بالاتصال على رقم الجامعة", "بالذهاب للعمادة شخصياً", "", "a",
             "طلبات الاعتذار تُقدم إلكترونياً عبر البوابة الأكاديمية.", "دليل الخدمات الإلكترونية", "القبول والتسجيل"),
            (22, 4, "ما أقل معدل تراكمي للحصول على مرتبة الشرف الأولى عند التخرج (من 4.00)؟",
             "3.75 من 4.00", "3.25 من 4.00", "3.00 من 4.00", "", "a",
             "مرتبة الشرف الأولى تتطلب معدل تراكمي 3.75 من 4.00 فأعلى عند التخرج.", "لائحة التخرج ومرتبة الشرف", "القبول والتسجيل"),
            (23, 4, "أين يمكن للطالب طباعة الإفادة الطلابية الرسمية؟",
             "من نظام سجلات الطلاب (البوابة الأكاديمية)", "من البريد الإلكتروني", "من مكتب الأستاذ", "", "a",
             "الإفادات الطلابية تُطبع من البوابة الأكاديمية (نظام سجلات الطلاب).", "دليل الخدمات الإلكترونية", "القبول والتسجيل"),

            # Station 5: شؤون الطلاب (slides 27, 28, 29)
            (27, 5, "أي جهة في الجامعة تقدم السُلف والإعانات المالية للطالب؟",
             "عمادة شؤون الطلاب", "عمادة القبول والتسجيل", "كلية إدارة الأعمال", "", "a",
             "عمادة شؤون الطلاب هي المختصة بالدعم المالي والسُلف والإعانات.", "دليل خدمات عمادة شؤون الطلاب", "شؤون الطلاب"),
            (28, 5, "ما فائدة السجل المهاري للطالب؟",
             "وثيقة رسمية تُوثق أنشطته ودوراته لسوق العمل", "بطاقة دخول للمكتبة", "كشف درجات إضافي", "", "a",
             "السجل المهاري يُوثق رسمياً أنشطتك ودوراتك وشهاداتك اللاصفية.", "دليل السجل المهاري للأنشطة الطلابية", "شؤون الطلاب"),
            (29, 5, "ما المقصود بالتشغيل الطلابي؟",
             "فرص عمل جزئي مدفوعة داخل الجامعة أثناء الدراسة", "تسجيل المقررات تلقائياً", "نظام حضور إلكتروني", "", "a",
             "التشغيل الطلابي = فرص عمل جزئي مدفوعة داخل الجامعة أثناء الدراسة.", "لائحة برنامج التشغيل الطلابي", "شؤون الطلاب"),
        ]

        for jq in journey_questions_seed:
            slide_num, station_num, question, opt_a, opt_b, opt_c, opt_d, correct, explanation, article_ref, doc_name = jq
            if slide_num not in existing_journey:
                c.execute("""
                    INSERT INTO quiz_questions
                    (question, option_a, option_b, option_c, option_d, correct_option,
                     explanation, article_ref, document_name, slide_number, station_number, is_journey)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                """, (question, opt_a, opt_b, opt_c, opt_d, correct, explanation, article_ref, doc_name, slide_num, station_num))

        conn.commit()
        conn.close()

        # Seed sample official students if empty
        from .official_students import seed_default_official_students
        seed_default_official_students()

        print("[Analytics] Database initialized & category links healed successfully.")
    except Exception as e:
        print(f"[Analytics] Error initializing database: {e}")
def get_system_setting(key, default=None):
    """Retrieve a global system setting."""
    try:
        conn = get_connection()
        row = conn.execute("SELECT value FROM system_settings WHERE key = ?", (key,)).fetchone()
        conn.close()
        return row['value'] if row else default
    except Exception:
        return default

def set_system_setting(key, value):
    """Set or update a global system setting."""
    try:
        conn = get_connection()
        conn.execute("""
            INSERT INTO system_settings (key, value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        """, (key, str(value)))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"[Analytics] set_system_setting error: {e}")
        return False
