"""Admin authentication (login/logout) and admin page renders."""
from flask import Blueprint, request, render_template, session, redirect, url_for, jsonify

from utils import admin_required
from config import ADMIN_USERNAME, ADMIN_PASSWORD
from services.analytics import get_dashboard_stats, get_university_comprehensive_report_db

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/api/admin/reports/comprehensive', methods=['GET'])
@admin_required
def admin_comprehensive_report():
    """Admin API to retrieve full executive university report."""
    from services.analytics import get_university_comprehensive_report_db
    report = get_university_comprehensive_report_db()
    return jsonify({'success': True, 'report': report})
@auth_bp.route('/admin/report')
@admin_required
def render_admin_report_page():
    """Render the official executive printable university leadership report."""
    from services.analytics import get_university_comprehensive_report_db
    report = get_university_comprehensive_report_db()
    return render_template('admin_report.html', report=report)
@auth_bp.route('/login', methods=['GET', 'POST'])
@auth_bp.route('/admin/login', methods=['GET', 'POST'])
def login():
    if session.get("admin_logged_in"):
        return redirect(url_for("auth.dashboard"))

    error = None
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            session["admin_logged_in"] = True
            session.permanent = True
            next_url = request.args.get('next') or url_for('auth.dashboard')
            return redirect(next_url)
        else:
            error = "اسم المستخدم أو كلمة المرور غير صحيحة."

    return render_template('login.html', error=error)


@auth_bp.route('/logout')
def logout():
    session.pop("admin_logged_in", None)
    return redirect(url_for("auth.login"))


@auth_bp.route('/admin/dashboard')
@admin_required
def dashboard():
    stats = get_dashboard_stats()
    report = get_university_comprehensive_report_db()
    return render_template('dashboard.html', stats=stats, report=report)

@auth_bp.route('/admin/qrcodes')
@admin_required
def admin_qrcodes():
    return render_template('admin_qrcodes.html')
