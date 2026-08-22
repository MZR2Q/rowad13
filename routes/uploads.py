"""Generic admin file-upload endpoints for quiz question images/attachments."""
import os
import time
import uuid
from flask import Blueprint, request, jsonify, current_app

from utils import admin_required

ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.pdf', '.doc', '.docx', '.pptx', '.xlsx'}

uploads_bp = Blueprint('uploads', __name__)

@uploads_bp.route('/api/admin/upload-image', methods=['POST'])
@admin_required
def admin_upload_image():
    """Upload a single image for quiz questions."""
    try:
        if 'image' not in request.files:
            return jsonify({"success": False, "error": "لم يتم إرسال أي صورة"}), 400
            
        file = request.files['image']
        if file.filename == '':
            return jsonify({"success": False, "error": "اسم الملف فارغ"}), 400
            
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']:
            return jsonify({"success": False, "error": "نوع الملف غير مدعوم (استخدم صور JPG, PNG, WEBP, GIF)"}), 400
            
        upload_dir = os.path.join(current_app.static_folder, 'uploads', 'questions')
        os.makedirs(upload_dir, exist_ok=True)
        
        filename = f"q_img_{int(time.time())}_{uuid.uuid4().hex[:6]}{ext}"
        filepath = os.path.join(upload_dir, filename)
        file.save(filepath)
        
        rel_url = f"/static/uploads/questions/{filename}"
        return jsonify({"success": True, "url": rel_url})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@uploads_bp.route('/api/admin/upload-attachment', methods=['POST'])
@admin_required
def admin_upload_attachment():
    """Upload any attachment (image, PDF, document) for quiz questions."""
    try:
        if 'file' not in request.files:
            return jsonify({"success": False, "error": "لم يتم إرسال أي ملف"}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({"success": False, "error": "اسم الملف فارغ"}), 400
            
        original_name = file.filename
        ext = os.path.splitext(original_name)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            return jsonify({"success": False, "error": f"نوع الملف '{ext}' غير مدعوم. الأنواع المدعومة: صور، PDF، Word، PowerPoint، Excel"}), 400
            
        # Determine subfolder by type
        if ext in {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'}:
            subfolder = 'images'
            file_type = 'image'
        elif ext == '.pdf':
            subfolder = 'pdf'
            file_type = 'pdf'
        else:
            subfolder = 'docs'
            file_type = 'document'
            
        upload_dir = os.path.join(current_app.static_folder, 'uploads', 'questions', subfolder)
        os.makedirs(upload_dir, exist_ok=True)
        
        safe_name = f"attach_{int(time.time())}_{uuid.uuid4().hex[:6]}{ext}"
        filepath = os.path.join(upload_dir, safe_name)
        file.save(filepath)
        
        rel_url = f"/static/uploads/questions/{subfolder}/{safe_name}"
        return jsonify({
            "success": True, 
            "url": rel_url, 
            "original_name": original_name,
            "file_type": file_type,
            "extension": ext
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
