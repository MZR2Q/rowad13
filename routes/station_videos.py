"""Admin CRUD for station videos + student-facing station-videos listing."""
import json
import os
from flask import Blueprint, request, jsonify

from utils import admin_required
from services.analytics import (
    get_all_station_videos_db, add_station_video_db, update_station_video_db,
    delete_station_video_db, get_active_station_videos_db,
)

station_videos_bp = Blueprint('station_videos', __name__)

@station_videos_bp.route('/api/admin/station-videos', methods=['GET'])
@admin_required
def admin_get_station_videos():
    """Admin API to retrieve all station videos (DB + landing_config.json)."""
    from services.analytics import get_all_station_videos_db
    db_videos = get_all_station_videos_db()

    # Also include videos from landing_config.json
    config_path = os.path.join('data', 'landing_config.json')
    config_videos = []
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            cfg = json.load(f)
            raw = cfg.get('videos', [])
            for i, cv in enumerate(raw):
                # Check if this config video already exists in DB (by URL match)
                url = cv.get('url', '')
                already_in_db = any(dv.get('url') == url for dv in db_videos)
                if not already_in_db and url:
                    config_videos.append({
                        'id': f'config-{i}',
                        'title': cv.get('caption', f'مقطع الصفحة {i+1}'),
                        'url': url,
                        'station_num': cv.get('station_num', None),
                        'sort_order': i,
                        'is_active': 1,
                        'source': 'landing_config',
                        'created_at': ''
                    })
    except Exception:
        pass

    all_videos = config_videos + db_videos
    return jsonify({'success': True, 'videos': all_videos})


@station_videos_bp.route('/api/admin/station-videos', methods=['POST'])
@admin_required
def admin_add_station_video():
    """Admin API to add a new station video."""
    data = request.get_json() or {}
    from services.analytics import add_station_video_db
    result = add_station_video_db(
        title=data.get('title', ''),
        url=data.get('url', ''),
        station_num=data.get('station_num'),
        sort_order=data.get('sort_order', 0)
    )
    return jsonify(result)


@station_videos_bp.route('/api/admin/station-videos/<int:video_id>', methods=['PUT'])
@admin_required
def admin_update_station_video(video_id):
    """Admin API to update an existing station video."""
    data = request.get_json() or {}
    from services.analytics import update_station_video_db
    result = update_station_video_db(
        video_id=video_id,
        title=data.get('title'),
        url=data.get('url'),
        station_num=data.get('station_num', '__unchanged__'),
        sort_order=data.get('sort_order'),
        is_active=data.get('is_active')
    )
    return jsonify(result)


@station_videos_bp.route('/api/admin/station-videos/<int:video_id>', methods=['DELETE'])
@admin_required
def admin_delete_station_video(video_id):
    """Admin API to delete a station video."""
    from services.analytics import delete_station_video_db
    result = delete_station_video_db(video_id)
    return jsonify(result)


@station_videos_bp.route('/api/student/station-videos', methods=['GET'])
def student_get_station_videos():
    """Student API to retrieve active station videos."""
    from services.analytics import get_active_station_videos_db
    videos = get_active_station_videos_db()
    return jsonify({'success': True, 'videos': videos})
