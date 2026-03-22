from flask import Blueprint, jsonify, Response

health_bp = Blueprint("health", __name__)


@health_bp.get("/health")
def health() -> Response:
    return jsonify({"status": "ok"})
