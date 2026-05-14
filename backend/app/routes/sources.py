from flask import Blueprint, jsonify, request, Response

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


@sources_bp.get("/lichess-tactics/items")
@login_required
def lichess_tactics_items() -> Response:
    page = max(1, request.args.get("page", 1, type=int))
    rating_min = request.args.get("ratingMin", None, type=int)
    rating_max = request.args.get("ratingMax", None, type=int)
    theme = request.args.get("theme", None, type=str) or None
    openings_param = request.args.get("openings", None, type=str)
    opening_names = [o.strip() for o in openings_param.split(",") if o.strip()] if openings_param else []
    return jsonify(svc.list_items(page, rating_min, rating_max, theme, opening_names))
