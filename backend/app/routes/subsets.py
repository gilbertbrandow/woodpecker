from flask import Blueprint, jsonify, request, session, Response

from app.decorators import login_required
from app.extensions import db
from app.models.user import User
from app.services import subset as subset_svc
from app.utils import parse_multi_filter

subsets_bp = Blueprint("subsets", __name__, url_prefix="/subsets")


@subsets_bp.get("/suggest")
@login_required
def suggest_subsets() -> Response:
    limit = min(20, max(1, int(request.args.get("limit", "8"))))
    return jsonify(subset_svc.suggest_subsets(limit=limit))


@subsets_bp.get("/search")
@login_required
def search_subsets() -> Response:
    q = request.args.get("q", "").strip()
    limit = min(50, max(1, int(request.args.get("limit", "10"))))
    if not q:
        return jsonify([])
    return jsonify(subset_svc.search_subsets(q, limit=limit))


@subsets_bp.get("/by-ids")
@login_required
def get_subsets_by_ids() -> Response:
    ids_raw = request.args.get("ids", "")
    ids = [int(x) for x in ids_raw.split(",") if x.strip().isdigit()]
    return jsonify(subset_svc.get_subsets_by_ids(ids))


@subsets_bp.post("")
@login_required
def create_subset() -> tuple[Response, int]:
    data: dict[str, object] = request.get_json(silent=True) or {}
    name = data.get("name", "")
    puzzle_count_raw = data.get("puzzleCount")
    if not isinstance(name, str):
        return jsonify({"error": "name must be a string"}), 400
    if not isinstance(puzzle_count_raw, int):
        return jsonify({"error": "puzzleCount must be an integer"}), 400
    subset = subset_svc.create_subset(session["user_id"], name, puzzle_count_raw)
    return jsonify(subset_svc.subset_to_dict(subset)), 201


@subsets_bp.get("")
@login_required
def list_subsets() -> Response:
    locked_only = request.args.get("locked") == "true"
    search = request.args.get("search") or None
    page_raw = request.args.get("page")
    page_size_raw = request.args.get("pageSize")
    page = int(page_raw) if page_raw and page_raw.isdigit() else 1
    page_size = int(page_size_raw) if page_size_raw and page_size_raw.isdigit() else 20
    user_ids_raw = request.args.get("userIds")
    user_ids_parts = [s.strip() for s in user_ids_raw.split(",") if s.strip()] if user_ids_raw else []
    user_ids_op, user_ids_vals = parse_multi_filter(user_ids_parts)
    user_ids = [int(x) for x in user_ids_vals if x.isdigit()] or None
    statuses_raw = request.args.get("statuses")
    statuses_parts = [s.strip() for s in statuses_raw.split(",") if s.strip()] if statuses_raw else []
    statuses_op, statuses_vals = parse_multi_filter(statuses_parts)
    result = subset_svc.list_subsets(
        session["user_id"],
        locked_only=locked_only,
        statuses=statuses_vals or None,
        statuses_op=statuses_op,
        search=search,
        page=page,
        page_size=page_size,
        user_ids=user_ids,
        user_ids_op=user_ids_op,
    )
    return jsonify(result)


@subsets_bp.get("/<int:subset_id>")
@login_required
def get_subset(subset_id: int) -> tuple[Response, int] | Response:
    subset, owner = subset_svc.get_subset(subset_id, session["user_id"])
    return jsonify(subset_svc.subset_to_dict(subset, owner))


@subsets_bp.delete("/<int:subset_id>")
@login_required
def delete_subset(subset_id: int) -> tuple[Response, int]:
    subset_svc.delete_subset(subset_id, session["user_id"])
    return jsonify(), 204


@subsets_bp.patch("/<int:subset_id>/config")
@login_required
def save_config(subset_id: int) -> tuple[Response, int] | Response:
    data: dict[str, object] = request.get_json(silent=True) or {}
    puzzle_count_raw = data.get("puzzleCount")
    config_raw = data.get("config")
    if not isinstance(puzzle_count_raw, int):
        return jsonify({"error": "puzzleCount must be an integer"}), 400
    if config_raw is not None and not isinstance(config_raw, dict):
        return jsonify({"error": "config must be an object"}), 400
    config: dict[str, object] = config_raw if isinstance(config_raw, dict) else {}
    subset = subset_svc.save_config(subset_id, session["user_id"], puzzle_count_raw, config)
    owner = db.session.get(User, session["user_id"])
    return jsonify(subset_svc.subset_to_dict(subset, owner))


@subsets_bp.post("/<int:subset_id>/fill")
@login_required
def fill(subset_id: int) -> tuple[Response, int]:
    filled, requested = subset_svc.fill(subset_id, session["user_id"])
    return jsonify({"filled": filled, "requested": requested}), 200


@subsets_bp.post("/<int:subset_id>/refill")
@login_required
def refill(subset_id: int) -> tuple[Response, int]:
    filled, needed = subset_svc.refill(subset_id, session["user_id"])
    return jsonify({"filled": filled, "needed": needed}), 200


VALID_SORT_PARAMS = {"rating", "popularity", "nb_plays"}


@subsets_bp.get("/<int:subset_id>/puzzles")
@login_required
def get_puzzles(subset_id: int) -> tuple[Response, int] | Response:
    try:
        page = int(request.args.get("page", "1"))
    except ValueError:
        return jsonify({"error": "page must be an integer"}), 400
    sort = request.args.get("sort") or None
    if sort is not None and sort not in VALID_SORT_PARAMS:
        return jsonify({"error": f"sort must be one of: {', '.join(sorted(VALID_SORT_PARAMS))}"}), 400
    order = request.args.get("order", "asc").lower()
    if order not in ("asc", "desc"):
        return jsonify({"error": "order must be 'asc' or 'desc'"}), 400
    result = subset_svc.list_active_puzzles(subset_id, session["user_id"], page, sort, order)
    return jsonify(result)


@subsets_bp.delete("/<int:subset_id>/puzzles/<int:training_item_id>")
@login_required
def discard_puzzle(subset_id: int, training_item_id: int) -> tuple[Response, int]:
    subset_svc.discard_puzzle(subset_id, training_item_id, session["user_id"])
    return jsonify(), 204


@subsets_bp.get("/<int:subset_id>/stats")
@login_required
def get_stats(subset_id: int) -> tuple[Response, int] | Response:
    stats = subset_svc.get_stats(subset_id, session["user_id"])
    return jsonify(stats)


@subsets_bp.post("/<int:subset_id>/lock")
@login_required
def lock_subset(subset_id: int) -> tuple[Response, int] | Response:
    subset = subset_svc.lock_subset(subset_id, session["user_id"])
    owner = db.session.get(User, session["user_id"])
    return jsonify(subset_svc.subset_to_dict(subset, owner))
