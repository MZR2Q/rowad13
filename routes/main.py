"""Landing page, print page, data-clear utility, landing-config APIs, calendar API."""
import os
import json
from flask import Blueprint, request, jsonify, render_template, session, current_app

main_bp = Blueprint('main', __name__)

@main_bp.route('/print')
def print_page():
    # Dedicated page for luxurious document and chat printing
    return render_template('print.html')

@main_bp.route('/')
def index():
    config_path = os.path.join('data', 'landing_config.json')
    landing_config = {"videos": [], "video_enabled": False}
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            landing_config = json.load(f)
    except Exception:
        pass
    # Backward compatibility: migrate old single-video format
    if 'video_url' in landing_config and landing_config['video_url']:
        landing_config['videos'] = [{"url": landing_config['video_url'], "caption": landing_config.get('video_caption', '')}]
    # Fetch station videos from DB and merge into carousel videos
    station_videos = []
    try:
        from services.analytics import get_active_station_videos_db
        station_videos = get_active_station_videos_db()
        # Merge DB station videos into the carousel videos list
        for sv in station_videos:
            landing_config['videos'].append({
                "url": sv.get('url', ''),
                "caption": sv.get('title', ''),
                "station_video_id": sv.get('id'),
                "station_num": sv.get('station_num')
            })
        # If we have station videos, ensure video is enabled
        if station_videos:
            landing_config['video_enabled'] = True
    except Exception:
        station_videos = []
    return render_template('landing.html', landing_config=landing_config, station_videos=station_videos)
@main_bp.route('/api/admin/landing-config', methods=['GET'])
def get_landing_config():
    if not session.get('admin_logged_in'):
        return jsonify({"error": "unauthorized"}), 401
    config_path = os.path.join('data', 'landing_config.json')
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            # Backward compatibility
            if 'video_url' in data and data['video_url'] and 'videos' not in data:
                data['videos'] = [{"url": data['video_url'], "caption": data.get('video_caption', '')}]
            return jsonify(data)
    except Exception:
        return jsonify({"videos": [], "video_enabled": False})

@main_bp.route('/api/admin/landing-config', methods=['POST'])
def save_landing_config():
    if not session.get('admin_logged_in'):
        return jsonify({"error": "unauthorized"}), 401
    data = request.get_json()
    config_path = os.path.join('data', 'landing_config.json')
    config = {
        "videos": data.get("videos", []),
        "video_enabled": data.get("video_enabled", False)
    }
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)
    return jsonify({"success": True})

@main_bp.route('/api/admin/upload-video', methods=['POST'])
def upload_video():
    if not session.get('admin_logged_in'):
        return jsonify({"error": "unauthorized"}), 401
    try:
        if 'video' not in request.files:
            return jsonify({"error": "no file field"}), 400
        file = request.files['video']
        if file.filename == '':
            return jsonify({"error": "empty filename"}), 400
        upload_dir = os.path.join(current_app.root_path, 'static', 'uploads')
        os.makedirs(upload_dir, exist_ok=True)
        ext = os.path.splitext(file.filename)[1].lower() or '.mp4'
        # Unique name using timestamp
        import time as _t
        filename = f"video_{int(_t.time())}{ext}"
        filepath = os.path.join(upload_dir, filename)
        file.save(filepath)
        file_size = os.path.getsize(filepath)
        print(f'[Upload] Video saved: {filepath} ({file_size} bytes)')
        video_url = f"/static/uploads/{filename}"
        return jsonify({"success": True, "video_url": video_url})
    except Exception as e:
        print(f'[Upload] ERROR: {e}')
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
@main_bp.route('/clear')
def clear_all():
    try:
        from services.analytics import clear_all_student_activity_data
        clear_all_student_activity_data()
    except Exception as e:
        print(f"[Clear API] Error: {e}")
    return '''<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>مسح البيانات</title>
<style>
body { font-family: 'Tajawal', sans-serif; background: #FAF8F5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
.card { background: #FFFFFF; border: 1.5px solid #E8DDD2; border-radius: 20px; padding: 40px; text-align: center; box-shadow: 0 8px 30px rgba(122,36,22,0.08); max-width: 420px; }
h1 { color: #059669; font-size: 1.4rem; margin-bottom: 8px; }
p { color: #6B5B50; font-size: 0.95rem; }
</style>
</head><body>
<div class="card">
  <h1>✅ تم مسح جميع النقاط والمحاولات بنجاح!</h1>
  <p>تم تصفير قاعدة البيانات والمتصفح بنجاح... جارٍ تحويلك للصفحة الرئيسية.</p>
</div>
<script>
// 1. Nuke ALL localStorage completely
localStorage.clear();
sessionStorage.clear();

// 2. Prevent auto-login from restoring anything
document.cookie.split(";").forEach(c => {
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
});

// 3. Redirect after 1.5 seconds
setTimeout(function() { window.location.replace("/"); }, 1500);
</script>
</body></html>'''


# Chat page removed — SPA design

@main_bp.route('/api/calendar')
def get_calendar_data():
    """Return academic calendar data as JSON."""
    cal_path = os.path.join(current_app.root_path, 'data', 'academic_calendar_1448_1449.json')
    try:
        with open(cal_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify(data)
    except Exception:
        return jsonify({'semesters': []})
