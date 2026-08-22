"""Journey email-verification flow, journey score/questions APIs, journey-questions CRUD (JSON-file backed)."""
import os
import re
import json
import time
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import Blueprint, request, jsonify, session

from utils import admin_required
from config import BASE_DIR, SMTP_EMAIL, SMTP_PASSWORD, SMTP_SERVER, SMTP_PORT, STUDENT_EMAIL_DOMAIN
from services.analytics import (
    save_quiz_attempt, get_journey_questions_for_student, get_journey_correct_answers_map,
    get_all_quiz_categories, get_all_quiz_questions,
)

journey_bp = Blueprint('journey', __name__)

@journey_bp.route('/api/journey/send-code', methods=['POST'])
def journey_send_code():
    """Generate verification code and send to student email."""
    data = request.get_json()
    student_id = data.get('student_id', '').strip()
    student_name = data.get('student_name', '').strip()

    if not student_id:
        return jsonify({'success': False, 'error': 'الرقم الجامعي مطلوب'}), 400

    # Generate 4-digit code
    code = str(random.randint(1000, 9999))

    # Store code in Flask session (survives server restarts)
    session['journey_code'] = code
    session['journey_student_id'] = student_id
    session['journey_name'] = student_name
    session['journey_timestamp'] = time.time()

    student_email = f"s{student_id}@{STUDENT_EMAIL_DOMAIN}"
    email_sent = False

    # Try to send email if SMTP is configured
    if SMTP_EMAIL and SMTP_PASSWORD:
        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = f'🎓 رواد 13 - رمز التحقق: {code}'
            msg['From'] = f'رواد 13 <{SMTP_EMAIL}>'
            msg['To'] = student_email

            html_body = f"""
            <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px; background: #FFF; border-radius: 16px;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <h1 style="color: #8B1A26; font-size: 1.8rem;">🎓 رواد 13</h1>
                    <p style="color: #666;">جامعة حفر الباطن</p>
                </div>
                <div style="background: linear-gradient(135deg, #8B1A26, #A0212E); color: #fff; padding: 28px; border-radius: 12px; text-align: center; margin: 20px 0;">
                    <p style="margin: 0 0 8px; font-size: 0.9rem; opacity: 0.8;">رمز التحقق الخاص بك</p>
                    <div style="font-size: 2.5rem; font-weight: 900; letter-spacing: 12px; color: #FFD700;">{code}</div>
                </div>
                <p style="color: #555; text-align: center; font-size: 0.85rem;">مرحباً <strong>{student_name}</strong>، استخدم هذا الرمز لإكمال رحلتك الأكاديمية في رواد 13.</p>
                <p style="color: #999; text-align: center; font-size: 0.75rem; margin-top: 24px;">هذا الرمز صالح لمدة 10 دقائق فقط.</p>
            </div>
            """

            msg.attach(MIMEText(html_body, 'html', 'utf-8'))

            with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
                server.starttls()
                server.login(SMTP_EMAIL, SMTP_PASSWORD)
                server.send_message(msg)

            email_sent = True
            print(f"[Journey] ✅ Verification code sent to {student_email}")

        except Exception as e:
            print(f"[Journey] ❌ Email sending failed: {e}")
            email_sent = False

    if not email_sent:
        print(f"[Journey] ⚠️ SMTP not configured. Code for {student_id}: {code}")

    return jsonify({
        'success': True,
        'email_sent': email_sent,
        'student_email': student_email,
        'fallback_code': code if not email_sent else None
    })


@journey_bp.route('/api/journey/verify-code', methods=['POST'])
def journey_verify_code():
    """Verify the code entered by the student."""
    data = request.get_json()
    entered_code = data.get('code', '').strip()

    stored_code = session.get('journey_code')
    timestamp = session.get('journey_timestamp', 0)

    if not stored_code:
        return jsonify({'success': False, 'error': 'لم يتم إرسال رمز تحقق. حاول مرة أخرى.'}), 400

    # Check expiry (10 minutes)
    if time.time() - timestamp > 600:
        session.pop('journey_code', None)
        return jsonify({'success': False, 'error': 'انتهت صلاحية الرمز. أعد الإرسال.'}), 400

    if entered_code == stored_code:
        name = session.get('journey_name', '')
        session.pop('journey_code', None)
        return jsonify({'success': True, 'name': name})
    else:
        return jsonify({'success': False, 'error': 'الرمز غير صحيح. حاول مرة أخرى.'}), 400


@journey_bp.route('/api/journey/save-score', methods=['POST'])
def journey_save_score():
    """Save journey score to leaderboard (combined with quiz)."""
    data = request.get_json()
    student_name = data.get('name', '').strip()
    student_id = data.get('student_id', '').strip()
    journey_score = data.get('journey_score', 0)
    time_seconds = data.get('time_seconds', 0)

    if not student_name or not student_id:
        return jsonify({'success': False}), 400

    try:
        # Calculate correct answers equivalent (out of 7 questions + 1 email)
        max_score = 800
        correct_equiv = round((journey_score / max_score) * 8)  # Out of 8 stages
        score_pct = round((journey_score / max_score) * 100)

        save_quiz_attempt(
            student_id=student_id,
            student_name=student_name,
            total_questions=8,
            correct_answers=correct_equiv,
            wrong_answers=max(0, 8 - correct_equiv),
            score_percent=score_pct,
            time_taken_seconds=time_seconds,
            category_name="رحلة رواد 13 الأكاديمية"
        )
        print(f"[Journey] 💾 Score saved: {student_name} ({student_id}) = {journey_score}/800 in {time_seconds}s")
        return jsonify({'success': True})
    except Exception as e:
        print(f"[Journey] ❌ Score save error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@journey_bp.route('/api/journey/questions', methods=['GET'])
def get_journey_questions_api():
    """Return journey quiz questions from DB for the student frontend.
    Correct answers are NOT included — verification is server-side."""
    try:
        questions = get_journey_questions_for_student()
        correct_map = get_journey_correct_answers_map()
        return jsonify({
            'success': True,
            'questions': questions,
            'correctAnswers': correct_map  # {slide_num: correct_idx}
        })
    except Exception as e:
        print(f"[Journey] ❌ Questions fetch error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
@journey_bp.route('/api/journey/dynamic-sections', methods=['GET'])
def get_journey_dynamic_sections():
    """Get all categories with their browse cards and questions for the interactive journey."""
    try:
        categories = get_all_quiz_categories()
        result = []
        for cat in categories:
            cid = cat['id']
            questions = get_all_quiz_questions(category_id=cid)
            result.append({
                "id": cid,
                "name": cat['name'],
                "description": cat.get('description', ''),
                "icon": cat.get('icon', 'fa-folder'),
                "color": cat.get('color', '#882D1B'),
                "browse_cards": cat.get('browse_cards', []),
                "questions": questions
            })
        return jsonify({"success": True, "categories": result})
    except Exception as e:
        print(f"[Journey] get_journey_dynamic_sections error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
JOURNEY_JSON_PATH = os.path.join(BASE_DIR, 'data', 'journey_questions.json')

def _load_journey_questions():
    if os.path.exists(JOURNEY_JSON_PATH):
        try:
            with open(JOURNEY_JSON_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def _save_journey_questions(data):
    os.makedirs(os.path.dirname(JOURNEY_JSON_PATH), exist_ok=True)
    with open(JOURNEY_JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

@journey_bp.route('/api/journey-questions', methods=['GET'])
def get_journey_questions():
    data = _load_journey_questions()
    return jsonify({"success": True, "questions": data})

@journey_bp.route('/api/admin/journey-questions', methods=['GET'])
@admin_required
def admin_get_journey_questions():
    data = _load_journey_questions()
    return jsonify({"success": True, "questions": data})

@journey_bp.route('/api/admin/journey-questions/edit/<step_id>', methods=['POST'])
@admin_required
def admin_edit_journey_question(step_id):
    """Edit an existing journey step — full field support."""
    try:
        payload = request.get_json() or {}
        data = _load_journey_questions()
        if step_id not in data:
            data[step_id] = {}

        # Update all provided fields
        updatable = ['title', 'description', 'question', 'explanation', 
                     'image_url', 'options', 'correct', 'question_type',
                     'correct_answer_index', 'hint', 'icon', 'badge_class']
        for field in updatable:
            if field in payload:
                val = payload[field]
                if isinstance(val, str):
                    val = val.strip()
                data[step_id][field] = val

        _save_journey_questions(data)
        return jsonify({"success": True, "message": "تم حفظ تعديلات المحطة بنجاح!"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@journey_bp.route('/api/admin/journey-questions/add', methods=['POST'])
@admin_required
def admin_add_journey_question():
    """Add a new journey step at the end."""
    try:
        payload = request.get_json() or {}
        data = _load_journey_questions()
        
        # Find next step ID (max existing + 1)
        existing_ids = [int(k) for k in data.keys() if k.isdigit()]
        next_id = str(max(existing_ids) + 1 if existing_ids else 1)
        
        # Build the new step
        new_step = {
            "title": payload.get('title', 'محطة جديدة').strip(),
            "description": payload.get('description', '').strip(),
            "question": payload.get('question', '').strip(),
            "question_type": payload.get('question_type', 'mcq'),  # mcq, tf, open
            "options": payload.get('options', []),
            "correct": payload.get('correct', '').strip() if isinstance(payload.get('correct', ''), str) else payload.get('correct', ''),
            "correct_answer_index": payload.get('correct_answer_index', 0),
            "explanation": payload.get('explanation', '').strip(),
            "hint": payload.get('hint', '').strip(),
            "image_url": payload.get('image_url', '').strip(),
            "icon": payload.get('icon', 'fa-circle-question'),
            "badge_class": payload.get('badge_class', 'pill-info')
        }
        
        data[next_id] = new_step
        _save_journey_questions(data)
        
        return jsonify({
            "success": True, 
            "message": f"تم إضافة المحطة #{next_id} بنجاح!",
            "step_id": next_id
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@journey_bp.route('/api/admin/journey-questions/delete/<step_id>', methods=['POST'])
@admin_required
def admin_delete_journey_question(step_id):
    """Delete a journey step and re-number remaining steps."""
    try:
        data = _load_journey_questions()
        if step_id not in data:
            return jsonify({"success": False, "error": "المحطة غير موجودة"}), 404
        
        del data[step_id]
        
        # Re-number steps sequentially (1, 2, 3, ...)
        sorted_keys = sorted(data.keys(), key=lambda x: int(x) if x.isdigit() else 999)
        renumbered = {}
        for i, key in enumerate(sorted_keys, 1):
            renumbered[str(i)] = data[key]
        
        _save_journey_questions(renumbered)
        return jsonify({"success": True, "message": "تم حذف المحطة وإعادة ترقيم المحطات بنجاح!"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@journey_bp.route('/api/admin/journey-questions/reorder', methods=['POST'])
@admin_required
def admin_reorder_journey_questions():
    """Reorder journey steps based on provided order array."""
    try:
        payload = request.get_json() or {}
        new_order = payload.get('order', [])  # e.g. ["3", "1", "2", "4"]
        
        data = _load_journey_questions()
        reordered = {}
        for i, old_id in enumerate(new_order, 1):
            if str(old_id) in data:
                reordered[str(i)] = data[str(old_id)]
        
        _save_journey_questions(reordered)
        return jsonify({"success": True, "message": "تم إعادة ترتيب المحطات بنجاح!"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
