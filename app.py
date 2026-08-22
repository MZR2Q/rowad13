import time
from flask import Flask, jsonify
from dotenv import load_dotenv

from config import SECRET_KEY, MAX_CONTENT_LENGTH, ADMIN_USERNAME, ADMIN_PASSWORD
from services.analytics import init_analytics_db
from routes import register_blueprints

load_dotenv()

app = Flask(__name__)
app.secret_key = SECRET_KEY
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

# تهيئة قاعدة بيانات التحليلات
init_analytics_db()

register_blueprints(app)

print(f"[Auth] Admin credentials loaded: {ADMIN_USERNAME} / {'*' * len(ADMIN_PASSWORD)}")


# ─── منع الكاش — البراوزر دائماً يجيب بيانات جديدة ──────────
@app.after_request
def add_no_cache_headers(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

@app.context_processor
def inject_cache_buster():
    return {'import_time': int(time.time())}

@app.after_request
def add_no_cache_headers(response):
    """Prevent browser caching of JS/CSS files during development."""
    if response.content_type and ('javascript' in response.content_type or 'text/html' in response.content_type):
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response


@app.errorhandler(413)
def too_large(e):
    return jsonify({"error": "الملف كبير جداً. الحد الأقصى 500MB"}), 413


@app.after_request
def add_header(r):
    r.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    r.headers["Pragma"] = "no-cache"
    r.headers["Expires"] = "0"
    return r

if __name__ == '__main__':
    app.run(debug=True, port=8080)
