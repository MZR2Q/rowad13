import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "uhb-default-secret-key-change-in-production")
MAX_CONTENT_LENGTH = 500 * 1024 * 1024  # 500MB max upload

# ─── بيانات اعتماد الأدمن من .env ──────────────────────────
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME") or "admin"
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD") or "admin123"

# ─── إعدادات SMTP لإرسال كود التحقق ──────────────────────
SMTP_EMAIL = os.getenv("SMTP_EMAIL", "")          # مثال: yourapp@gmail.com
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")     # App Password من Gmail
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
STUDENT_EMAIL_DOMAIN = os.getenv("STUDENT_EMAIL_DOMAIN", "uhb.edu.sa")
