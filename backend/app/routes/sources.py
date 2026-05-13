from flask import Blueprint, jsonify, Response

from app.decorators import login_required
from app.services import lichess_tactics_source as svc

sources_bp = Blueprint("sources", __name__, url_prefix="/sources")


@sources_bp.get("/lichess-tactics/stats")
@login_required
def lichess_tactics_stats() -> Response:
    return jsonify(svc.get_stats())
