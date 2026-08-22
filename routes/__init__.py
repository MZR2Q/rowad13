from .main import main_bp
from .auth import auth_bp
from .journey import journey_bp
from .student import student_bp
from .quiz import quiz_bp
from .station_videos import station_videos_bp
from .uploads import uploads_bp
from .analytics_events import analytics_events_bp
from .legacy_chat import legacy_chat_bp


def register_blueprints(app):
    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(journey_bp)
    app.register_blueprint(student_bp)
    app.register_blueprint(quiz_bp)
    app.register_blueprint(station_videos_bp)
    app.register_blueprint(uploads_bp)
    app.register_blueprint(analytics_events_bp)
    app.register_blueprint(legacy_chat_bp)
