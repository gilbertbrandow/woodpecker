from flask import Blueprint, jsonify, Response

from app.decorators import login_required
from app.services import lichess_tactics_source as svc

sources_bp = Blueprint("sources", __name__, url_prefix="/sources")


@sources_bp.get("/lichess-tactics/stats")
@login_required
def lichess_tactics_stats() -> Response:
    return jsonify(svc.get_stats())


@sources_bp.get("/lichess-tactics/rating-distribution")
@login_required
def lichess_tactics_rating_distribution() -> Response:
    return jsonify({"buckets": svc.get_rating_distribution()})


@sources_bp.get("/lichess-tactics/top-themes")
@login_required
def lichess_tactics_top_themes() -> Response:
    return jsonify({"themes": svc.get_top_themes()})
