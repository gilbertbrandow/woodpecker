import os
from flask import Flask
from app.extensions import db, cors, migrate
from app.routes.health import health_bp
from app.routes.auth import auth_bp
from app.routes.settings import settings_bp
from app.routes.subsets import subsets_bp
from app.routes.schedules import schedules_bp
from app.routes.training import training_bp
from app.routes.runs import runs_bp
from app.routes.themes import themes_bp
from app.routes.openings import openings_bp
from app.routes.leaderboard import leaderboard_bp
from app.routes.sources import sources_bp


def create_app() -> Flask:
    app = Flask(__name__)

    app.config["SECRET_KEY"] = os.environ["SECRET_KEY"]
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ["DATABASE_URL"]
    app.config["SESSION_COOKIE_SECURE"] = os.environ.get("SESSION_COOKIE_SECURE", "0") == "1"
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

    db.init_app(app)
    cors.init_app(app, origins=[os.environ.get("APP_ORIGIN", "http://localhost:5173")], supports_credentials=True)
    migrate.init_app(app, db)

    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(subsets_bp)
    app.register_blueprint(schedules_bp)
    app.register_blueprint(training_bp)
    app.register_blueprint(runs_bp)
    app.register_blueprint(themes_bp)
    app.register_blueprint(openings_bp)
    app.register_blueprint(leaderboard_bp)
    app.register_blueprint(sources_bp)

    return app
