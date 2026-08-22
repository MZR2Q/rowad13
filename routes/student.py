"""Student-facing progress/points/proof-upload/verification APIs + admin student views."""
import os
import re
import time
import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify, session, current_app

from utils import admin_required
from services.analytics import (
    get_student_by_id, save_student_progress_db, get_student_progress_db,
    get_all_students_progress_db, get_all_students_comprehensive_directory_db,
    get_single_student_full_dossier_db, record_student_video_view_db,
    get_all_students_video_analytics_db, lookup_official_student,
    get_all_official_students, add_or_update_official_student,
    record_qr_scan_db, record_workshop_attendance_db, record_survey_response_db,
    get_student_detailed_metrics_db, reset_student_progress_db,
    clear_all_student_activity_data, get_system_setting,
)

student_bp = Blueprint('student', __name__)

@student_bp.route('/api/student/lookup', methods=['GET', 'POST'])
def student_lookup():
    """Check if student ID is registered previously and return student_name."""
    if request.method == 'POST':
        data = request.get_json() or {}
        student_id = data.get('student_id', '').strip()
    else:
        student_id = request.args.get('student_id', '').strip()

    if not student_id:
        return jsonify({'success': False, 'error': 'الرقم الجامعي مطلوب'}), 400

    student_info = get_student_by_id(student_id)
    if student_info:
        return jsonify({
            'success': True,
            'found': True,
            'student_id': student_id,
            'student_name': student_info['student_name'],
            'total_attempts': student_info['total_attempts'],
            'max_score': student_info['max_score'],
            'last_score': student_info['last_score']
        })
    else:
        return jsonify({
            'success': True,
            'found': False,
            'student_id': student_id
        })


@student_bp.route('/api/student/progress', methods=['GET', 'POST'])
def handle_student_progress():
    """Get or Save unified student progress and points to SQLite database."""
    if request.method == 'POST':
        data = request.get_json() or {}
        student_id = str(data.get('student_id', '')).strip()
        if not student_id or student_id == 'guest_student':
            return jsonify({'success': False, 'error': 'الرقم الجامعي مطلوب'}), 400

        student_name = data.get('student_name', '')
        explore_points = float(data.get('explore_points', 0) or 0)
        quiz_points = float(data.get('quiz_points', 0) or 0)
        campus_points = float(data.get('campus_points', 0) or 0)
        total_points = float(data.get('total_points', 0) or 0)
        explored_docs = data.get('explored_docs', {})
        quiz_data = data.get('quiz_data', {})
        campus_data = data.get('campus_data', {})

        saved = save_student_progress_db(
            student_id=student_id,
            student_name=student_name,
            explore_points=explore_points,
            quiz_points=quiz_points,
            campus_points=campus_points,
            total_points=total_points,
            explored_docs=explored_docs,
            quiz_data=quiz_data,
            campus_data=campus_data
        )

        return jsonify({
            'success': bool(saved),
            'student_id': student_id,
            'total_points': total_points,
            'message': 'تم حفظ النقاط والتقدم في قاعدة البيانات بنجاح'
        })
    else:
        student_id = request.args.get('student_id', '').strip()
        if not student_id:
            return jsonify({'success': False, 'error': 'الرقم الجامعي مطلوب'}), 400

        from services.analytics import get_system_setting
        global_epoch = get_system_setting('global_reset_epoch', '')

        progress = get_student_progress_db(student_id)
        if progress:
            return jsonify({
                'success': True,
                'found': True,
                'global_reset_epoch': global_epoch,
                'data': progress
            })
        else:
            return jsonify({
                'success': True,
                'found': False,
                'global_reset_epoch': global_epoch,
                'student_id': student_id
            })


@student_bp.route('/api/admin/reset-student', methods=['POST'])
@admin_required
def admin_reset_student():
    """Admin API to reset points and progress for a single student."""
    data = request.get_json() or {}
    student_id = str(data.get('student_id', '')).strip()
    if not student_id:
        return jsonify({'success': False, 'error': 'الرقم الجامعي مطلوب'}), 400
    
    from services.analytics import reset_student_progress_db
    ok = reset_student_progress_db(student_id)
    return jsonify({
        'success': ok,
        'student_id': student_id,
        'message': f'تم تصفير نقاط الطالب {student_id} بنجاح'
    })


@student_bp.route('/api/admin/reset-all-students', methods=['POST'])
@admin_required
def admin_reset_all_students():
    """Admin API to reset points and progress for ALL students."""
    from services.analytics import clear_all_student_activity_data
    ok = clear_all_student_activity_data()
    return jsonify({
        'success': ok,
        'message': 'تم تصفير جميع نقاط ومحاولات الطلاب بنجاح'
    })


@student_bp.route('/api/admin/students-live', methods=['GET'])
@admin_required
def admin_students_live():
    """Admin API to retrieve live monitoring of all students with full metrics."""
    limit = int(request.args.get('limit', 100))
    students = get_all_students_progress_db(limit=limit)
    return jsonify({
        'success': True,
        'count': len(students),
        'students': students
    })


@student_bp.route('/api/admin/students/directory', methods=['GET'])
@admin_required
def admin_get_students_directory():
    """Admin API to retrieve all students with smart ranking and comprehensive stats."""
    sort_by = request.args.get('sort_by', 'smart')
    from services.analytics import get_all_students_comprehensive_directory_db
    students = get_all_students_comprehensive_directory_db(sort_by=sort_by)
    return jsonify({
        "success": True,
        "count": len(students),
        "students": students
    })


@student_bp.route('/api/admin/students/<student_id>/full-profile', methods=['GET'])
@admin_required
def admin_get_single_student_profile(student_id):
    """Admin API to retrieve 360-degree full profile for a single student."""
    from services.analytics import get_single_student_full_dossier_db
    profile = get_single_student_full_dossier_db(student_id)
    if not profile:
        return jsonify({"success": False, "error": "الطالب غير موجود"}), 404
    return jsonify({
        "success": True,
        "student": profile
    })
@student_bp.route('/api/student/upload-proof', methods=['POST'])
def student_upload_proof():
    """Upload and save student proof screenshot for Blackboard or Outlook email.
    
    IMPORTANT: The FIRST proof image is PRESERVED forever (renamed with _first suffix).
    Subsequent uploads only replace the 'latest' file. Admin sees both.
    All images are automatically compressed to max 1200px / 80% quality.
    """
    file = request.files.get('file') or request.files.get('image')
    student_id = str(request.form.get('student_id', '')).strip()
    proof_type = str(request.form.get('proof_type', 'general')).strip()

    if not file or file.filename == '':
        return jsonify({'success': False, 'error': 'لم يتم اختيار ملف'}), 400

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ['.png', '.jpg', '.jpeg', '.webp', '.pdf']:
        return jsonify({'success': False, 'error': 'نوع الملف غير مدعوم'}), 400

    upload_dir = os.path.join(current_app.static_folder, 'uploads', 'proofs')
    os.makedirs(upload_dir, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_sid = re.sub(r'[^a-zA-Z0-9_-]', '', student_id) or 'stu'
    safe_type = re.sub(r'[^a-zA-Z0-9_-]', '', proof_type).lower() or 'proof'

    # ─── Read file bytes once ─────────────────────────────────────────────────
    file_bytes = file.read()
    final_ext = ext  # May change to .jpg after compression

    # ─── Compress with Pillow (skip PDFs) ────────────────────────────────────
    if ext != '.pdf':
        try:
            from PIL import Image as _PIL_Image
            import io as _io
            img = _PIL_Image.open(_io.BytesIO(file_bytes))
            # Convert RGBA/P to RGB for JPEG compatibility
            if img.mode in ('RGBA', 'P', 'LA'):
                img = img.convert('RGB')
                final_ext = '.jpg'
            elif img.mode != 'RGB':
                img = img.convert('RGB')
                final_ext = '.jpg'
            # Resize if larger than 1200px on any axis
            MAX_DIM = 1200
            if img.width > MAX_DIM or img.height > MAX_DIM:
                img.thumbnail((MAX_DIM, MAX_DIM), _PIL_Image.LANCZOS)
            # Re-encode with compression
            buf = _io.BytesIO()
            save_fmt = 'JPEG' if final_ext in ['.jpg', '.jpeg'] else 'PNG'
            if save_fmt == 'JPEG':
                img.save(buf, format='JPEG', quality=80, optimize=True)
            else:
                img.save(buf, format='PNG', optimize=True)
            compressed = buf.getvalue()
            # Only use compressed version if it's smaller
            if len(compressed) < len(file_bytes):
                file_bytes = compressed
                print(f"[Uploads] Compressed: {len(file_bytes):,}B (ext={final_ext})")
        except Exception as _ce:
            print(f"[Uploads] Compression skipped: {_ce}")

    # Check if a "_first" proof already exists for this student+type
    first_proof_exists = False
    first_proof_url = None
    first_filename = None
    latest_filename = None
    prefix_patterns = [f"{safe_sid}_{safe_type}_first"]
    if safe_type in ['blackboard', 'bb']:
        prefix_patterns.append(f"{safe_sid}_bb_first")
        prefix_patterns.append(f"{safe_sid}_blackboard_first")

    try:
        for existing_file in os.listdir(upload_dir):
            for pat in prefix_patterns:
                if existing_file.startswith(pat):
                    first_proof_exists = True
                    first_proof_url = f"/static/uploads/proofs/{existing_file}"
                    first_filename = existing_file
                    break
            if first_proof_exists:
                break
    except Exception:
        pass

    def _write(path, data):
        with open(path, 'wb') as fh:
            fh.write(data)

    if not first_proof_exists:
        # This is the FIRST ever proof upload — save with "_first" suffix (IMMUTABLE)
        first_filename = f"{safe_sid}_{safe_type}_first_{timestamp}{final_ext}"
        first_filepath = os.path.join(upload_dir, first_filename)
        _write(first_filepath, file_bytes)
        first_proof_url = f"/static/uploads/proofs/{first_filename}"
        file_url = first_proof_url
        print(f"[Uploads] First proof saved (immutable): {first_filename}")
    else:
        # First proof exists — save as attempt_N file, delete previous attempt file
        attempt_num = max(2, int(request.form.get('attempt_num', 2) or 2))
        attempt_label = f"attempt{attempt_num}"

        # Delete any old attempt files for this student+type (but NEVER _first)
        try:
            for old_file in os.listdir(upload_dir):
                if '_first' in old_file:
                    continue  # Sacred — never delete
                # Match files for this student+type that are attempt files or old latest
                if old_file.startswith(f"{safe_sid}_{safe_type}_") and old_file != first_filename:
                    old_path = os.path.join(upload_dir, old_file)
                    if os.path.isfile(old_path):
                        os.remove(old_path)
                        print(f"[Uploads] Deleted previous attempt proof: {old_file}")
        except Exception as e:
            print(f"[Uploads] Error cleaning old proofs: {e}")

        # Save new attempt file
        latest_filename = f"{safe_sid}_{safe_type}_{attempt_label}_{timestamp}{final_ext}"
        latest_filepath = os.path.join(upload_dir, latest_filename)
        _write(latest_filepath, file_bytes)
        file_url = f"/static/uploads/proofs/{latest_filename}"
        print(f"[Uploads] Attempt {attempt_num} proof saved: {latest_filename} (first proof preserved)")


    return jsonify({
        'success': True,
        'url': file_url,
        'first_proof_url': first_proof_url,
        'filename': file.filename,
        'saved_as': latest_filename if first_proof_exists else first_filename,
        'is_first_upload': not first_proof_exists,
        'message': 'تم رفع الإثبات بنجاح (الإثبات الأول محفوظ دائماً)'
    })


@student_bp.route('/api/student/video-view', methods=['POST'])
def student_record_video_view():
    """Record student video viewing session into SQLite database."""
    data = request.get_json() or {}
    student_id = str(data.get('student_id', '')).strip()
    if not student_id or student_id == 'guest_student':
        return jsonify({'success': False, 'error': 'الرقم الجامعي مطلوب'}), 400

    student_name = str(data.get('student_name', '')).strip()
    video_index = int(data.get('video_index', 0))
    video_url = str(data.get('video_url', '')).strip()
    video_caption = str(data.get('video_caption', '')).strip()
    watched_seconds = float(data.get('watched_seconds', 0) or 0)
    video_duration = float(data.get('video_duration', 0) or 0)
    is_completed = 1 if data.get('is_completed', True) else 0

    from services.analytics import record_student_video_view_db
    saved = record_student_video_view_db(
        student_id=student_id,
        student_name=student_name,
        video_index=video_index,
        video_url=video_url,
        video_caption=video_caption,
        watched_seconds=watched_seconds,
        video_duration=video_duration,
        is_completed=is_completed
    )

    return jsonify({
        'success': bool(saved),
        'student_id': student_id,
        'video_index': video_index,
        'is_completed': bool(is_completed)
    })


@student_bp.route('/api/admin/videos/analytics', methods=['GET'])
@admin_required
def admin_get_videos_analytics():
    """Admin API to retrieve comprehensive video viewing analytics across all students."""
    from services.analytics import get_all_students_video_analytics_db
    analytics = get_all_students_video_analytics_db()
    return jsonify({
        'success': True,
        'analytics': analytics
    })
@student_bp.route('/api/student/verify-id', methods=['GET', 'POST'])
def verify_student_id():
    """Verify student ID: must be 10 digits starting strictly with 227 and in official DB."""
    if request.method == 'POST':
        data = request.get_json() or {}
        student_id = str(data.get('student_id', '')).strip()
    else:
        student_id = str(request.args.get('student_id', '')).strip()

    if not student_id or student_id.lower() == 'guest_student':
        return jsonify({'success': False, 'found': False, 'message': 'الرقم الجامعي مطلوب'}), 400

    # 1. Prefix Validation: Must start with 227
    if not student_id.startswith('227'):
        return jsonify({
            'success': False,
            'found': False,
            'error_type': 'FRESHMAN_ONLY',
            'message': '⚠️ يُسمح فقط للطلاب المستجدين فقط'
        }), 400

    # 2. Length Validation: Must be exactly 10 digits
    if len(student_id) != 10 or not student_id.isdigit():
        return jsonify({
            'success': False,
            'found': False,
            'error_type': 'INVALID_LENGTH',
            'message': '⚠️ الرقم الجامعي يجب أن يتكون من 10 أرقام بالضبط (مثال: 2270005709)'
        }), 400

    from services.analytics import lookup_official_student, get_student_progress_db, save_student_progress_db
    official = lookup_official_student(student_id)
    
    if official:
        # If student exists in official roster, ensure student_progress record has their real full name
        existing_prog = get_student_progress_db(student_id)
        if existing_prog:
            save_student_progress_db(
                student_id=student_id,
                student_name=official['full_name'],
                explore_points=existing_prog.get('explore_points', 0),
                quiz_points=existing_prog.get('quiz_points', 0),
                campus_points=existing_prog.get('campus_points', 0),
                workshop_points=existing_prog.get('workshop_points', 0),
                total_points=existing_prog.get('total_points', 0)
            )
        return jsonify({
            'success': True,
            'found': True,
            'student': {
                'student_id': official['student_id'],
                'full_name': official['full_name'],
                'college': official['college'],
                'gender': official['gender'],
                'national_id': official['national_id'],
                'mobile_phone': official['mobile_phone']
            },
            'welcome_message': f"مرحباً بك يا {official['full_name']} 🎓\nكليتك: {official['college']}"
        })
    else:
        return jsonify({
            'success': True,
            'found': False,
            'error_type': 'NOT_REGISTERED',
            'message': f'❌ الرقم الجامعي ({student_id}) غير مسجل في قوائم الطلاب المعتمدة لجامعة حفر الباطن!'
        })


@student_bp.route('/api/admin/official-students', methods=['GET', 'POST'])
def manage_official_students():
    """Admin API to list or add official students."""
    from services.analytics import get_all_official_students, add_or_update_official_student
    if request.method == 'POST':
        data = request.get_json() or {}
        student_id = str(data.get('student_id', '')).strip()
        national_id = str(data.get('national_id', '')).strip()
        mobile_phone = str(data.get('mobile_phone', '')).strip()
        full_name = str(data.get('full_name', '')).strip()
        college = str(data.get('college', '')).strip()
        gender = str(data.get('gender', '')).strip()

        if not student_id or not full_name:
            return jsonify({'success': False, 'message': 'الرقم الجامعي والاسم الثلاثي مطلوبان'}), 400

        ok = add_or_update_official_student(student_id, national_id, mobile_phone, full_name, college, gender)
        return jsonify({'success': ok, 'message': 'تم حفظ بيانات الطالب بنجاح'})

    students = get_all_official_students()
    return jsonify({'success': True, 'count': len(students), 'students': students})


@student_bp.route('/api/student/qr/scan', methods=['POST'])
def handle_student_qr_scan():
    """Record student QR scan at campus booths atomically."""
    data = request.get_json() or {}
    student_id = str(data.get('student_id', '')).strip()
    booth_code = str(data.get('booth_code', '')).strip()
    booth_name = str(data.get('booth_name', '')).strip()
    points = float(data.get('points', 10) or 10)

    if not student_id or not booth_code:
        return jsonify({'success': False, 'message': 'البيانات غير مكتملة'}), 400

    from services.analytics import record_qr_scan_db
    res = record_qr_scan_db(student_id, booth_code, booth_name, points)
    return jsonify(res)


@student_bp.route('/api/student/workshop/attend', methods=['POST'])
def handle_student_workshop_attend():
    """Record student workshop completion / attendance."""
    data = request.get_json() or {}
    student_id = str(data.get('student_id', '')).strip()
    workshop_id = str(data.get('workshop_id', '')).strip()
    workshop_title = str(data.get('workshop_title', '')).strip()
    day_number = int(data.get('day_number', 1) or 1)
    points = float(data.get('points', 15) or 15)

    if not student_id or not workshop_id:
        return jsonify({'success': False, 'message': 'البيانات غير مكتملة'}), 400

    from services.analytics import record_workshop_attendance_db
    res = record_workshop_attendance_db(student_id, workshop_id, workshop_title, day_number, points)
    return jsonify(res)


@student_bp.route('/api/survey/submit', methods=['POST'])
def handle_survey_submit():
    """Submit student experience evaluation survey."""
    data = request.get_json() or {}
    student_id = str(data.get('student_id', '')).strip()
    student_name = str(data.get('student_name', '')).strip()
    satisfaction = int(data.get('satisfaction', 5) or 5)
    organization = int(data.get('organization', 5) or 5)
    workshops = int(data.get('workshops', 5) or 5)
    navigation = int(data.get('navigation', 5) or 5)
    positive = str(data.get('positive_feedback', ''))
    suggestions = str(data.get('suggestions', ''))

    if not student_id:
        return jsonify({'success': False, 'message': 'الرقم الجامعي مطلوب'}), 400

    from services.analytics import record_survey_response_db
    res = record_survey_response_db(
        student_id=student_id,
        student_name=student_name,
        satisfaction=satisfaction,
        organization=organization,
        workshops=workshops,
        navigation=navigation,
        positive=positive,
        suggestions=suggestions,
        points=10.0
    )
    return jsonify(res)


@student_bp.route('/api/student/metrics', methods=['GET'])
def get_student_metrics():
    """Get smart comprehensive metrics breakdown for a student."""
    student_id = request.args.get('student_id', '').strip()
    if not student_id:
        return jsonify({'success': False, 'message': 'الرقم الجامعي مطلوب'}), 400

    from services.analytics import get_student_detailed_metrics_db
    metrics = get_student_detailed_metrics_db(student_id)
    if not metrics:
        return jsonify({'success': False, 'message': 'لا توجد سجلات لهذا الطالب'}), 404
    return jsonify({'success': True, 'metrics': metrics})
