"""Lightweight client-side analytics event beacons."""
from flask import Blueprint, request, jsonify

from utils import get_or_create_session_id
from services.analytics import log_source_click, log_ui_event

analytics_events_bp = Blueprint('analytics_events', __name__)

@analytics_events_bp.route('/analytics/source-click', methods=['POST'])
def analytics_source_click():
    try:
        sid = get_or_create_session_id()
        data = request.get_json() or {}
        log_source_click(
            session_id=sid,
            unique_id=data.get('unique_id', ''),
            document_id=data.get('document_id', ''),
            source_type=data.get('source_type', 'article'),
            label=data.get('label', '')
        )
    except Exception:
        pass
    return jsonify({"status": "ok"})


@analytics_events_bp.route('/analytics/ui-event', methods=['POST'])
def analytics_ui_event():
    try:
        sid = get_or_create_session_id()
        data = request.get_json() or {}
        log_ui_event(
            session_id=sid,
            event_name=data.get('event_name', ''),
            event_value=data.get('event_value')
        )
    except Exception:
        pass
    return jsonify({"status": "ok"})
