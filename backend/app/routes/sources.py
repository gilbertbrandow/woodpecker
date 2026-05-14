from flask import Blueprint, jsonify, request, Response

from app.decorators import login_required
from app.services import lichess_tactics_source as svc

sources_bp = Blueprint("sources", __name__, url_prefix="/sources")


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


@sources_bp.get("/lichess-tactics/source-run-metadata")
@login_required
def lichess_tactics_source_run_metadata() -> Response:
    return jsonify({"metadata": svc.get_latest_source_run_metadata()})
