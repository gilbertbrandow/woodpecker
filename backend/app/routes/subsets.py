from flask import Blueprint, jsonify, request, session, Response

from app.decorators import login_required
from app.models.subset import Subset
from app.services import subset as subset_svc

subsets_bp = Blueprint("subsets", __name__, url_prefix="/subsets")


def _subset_to_dict(subset: Subset) -> dict[str, object]:
    return {
        "id": subset.id,
        "name": subset.name,
        "status": subset.status,
        "puzzleCount": subset.puzzle_count,
        "config": subset.config,
        "createdAt": subset.created_at.isoformat(),
        "lockedAt": subset.locked_at.isoformat() if subset.locked_at else None,
    }


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
    try:
        subset = subset_svc.create_subset(session["user_id"], name, puzzle_count_raw)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(_subset_to_dict(subset)), 201


@subsets_bp.get("")
@login_required
def list_subsets() -> Response:
    subsets = subset_svc.list_subsets(session["user_id"])
    return jsonify([_subset_to_dict(s) for s in subsets])


@subsets_bp.get("/<int:subset_id>")
@login_required
def get_subset(subset_id: int) -> tuple[Response, int] | Response:
    try:
        subset = subset_svc.get_subset(subset_id, session["user_id"])
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    return jsonify(_subset_to_dict(subset))


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

    try:
        subset = subset_svc.save_config(subset_id, session["user_id"], puzzle_count_raw, config)
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(_subset_to_dict(subset))


@subsets_bp.post("/<int:subset_id>/fill")
@login_required
def fill(subset_id: int) -> tuple[Response, int]:
    try:
        filled, requested = subset_svc.fill(subset_id, session["user_id"])
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify({"filled": filled, "requested": requested}), 200


@subsets_bp.post("/<int:subset_id>/refill")
@login_required
def refill(subset_id: int) -> tuple[Response, int]:
    try:
        filled, needed = subset_svc.refill(subset_id, session["user_id"])
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify({"filled": filled, "needed": needed}), 200


@subsets_bp.get("/<int:subset_id>/puzzles")
@login_required
def get_puzzles(subset_id: int) -> tuple[Response, int] | Response:
    page_raw = request.args.get("page")
    cursor: int | None = None
    if page_raw is not None:
        try:
            cursor = int(page_raw)
        except ValueError:
            return jsonify({"error": "page must be an integer"}), 400

    try:
        result = subset_svc.list_active_puzzles(subset_id, session["user_id"], cursor)
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    return jsonify(result)


@subsets_bp.delete("/<int:subset_id>/puzzles/<lichess_puzzle_id>")
@login_required
def discard_puzzle(subset_id: int, lichess_puzzle_id: str) -> tuple[Response, int]:
    try:
        subset_svc.discard_puzzle(subset_id, lichess_puzzle_id, session["user_id"])
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    return "", 204


@subsets_bp.get("/<int:subset_id>/stats")
@login_required
def get_stats(subset_id: int) -> tuple[Response, int] | Response:
    try:
        stats = subset_svc.get_stats(subset_id, session["user_id"])
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    return jsonify(stats)


@subsets_bp.post("/<int:subset_id>/lock")
@login_required
def lock_subset(subset_id: int) -> tuple[Response, int] | Response:
    try:
        subset = subset_svc.lock_subset(subset_id, session["user_id"])
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    except ValueError as e:
        status_code = 409 if "Already locked" in str(e) else 400
        return jsonify({"error": str(e)}), status_code
    return jsonify(_subset_to_dict(subset))
