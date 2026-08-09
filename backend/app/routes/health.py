from flask import Blueprint, Response, jsonify

health_bp = Blueprint("health", __name__)


@health_bp.get("/health")
def health() -> Response:
    return jsonify({"status": "ok"})
