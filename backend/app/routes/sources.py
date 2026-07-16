from flask import Blueprint, jsonify, request, Response

from app.decorators import login_required
from app.services import decoy_source as decoy_svc
from app.services import lichess_tactics_source as svc
from app.services import scraped_positional_source as pos_svc
from app.services import sources as sources_svc
from app.table_query import TableQuery

sources_bp = Blueprint("sources", __name__, url_prefix="/sources")


@sources_bp.get("/")
@login_required
def list_sources() -> Response:
    return jsonify({"sources": sources_svc.list_sources()})


@sources_bp.get("/lichess-tactics/items")
@login_required
def lichess_tactics_items() -> Response:
    q = TableQuery(request)
    return jsonify(svc.list_items(
        page=q.page,
        page_size=q.page_size,
        rating=q.range_filter("rating"),
        theme=q.str_set_filter("theme"),
        opening=q.str_filter("opening"),
    ))


@sources_bp.get("/lichess-tactics/source-run-metadata")
@login_required
def lichess_tactics_source_run_metadata() -> Response:
    return jsonify({"metadata": svc.get_latest_source_run_metadata()})


@sources_bp.get("/scraped-positional/items")
@login_required
def scraped_positional_items() -> Response:
    page = max(1, request.args.get("page", 1, type=int))
    difficulty = request.args.get("difficulty", None, type=int)
    theme = request.args.get("theme", None, type=str) or None
    opening = request.args.get("opening", None, type=str) or None
    return jsonify(pos_svc.list_items(page, difficulty, theme, opening))


@sources_bp.get("/scraped-positional/source-run-metadata")
@login_required
def scraped_positional_source_run_metadata() -> Response:
    return jsonify({"metadata": pos_svc.get_latest_source_run_metadata()})


@sources_bp.get("/decoys/items")
@login_required
def decoy_items() -> Response:
    q = TableQuery(request)
    return jsonify(decoy_svc.list_items(
        page=q.page,
        page_size=q.page_size,
        opening=q.str_filter("opening"),
    ))


@sources_bp.get("/decoys/source-run-metadata")
@login_required
def decoy_source_run_metadata() -> Response:
    return jsonify({"metadata": decoy_svc.get_latest_source_run_metadata()})
