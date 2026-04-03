from flask import Blueprint, Response, jsonify, request, session

from app.decorators import login_required
from app.services import run as run_svc

attempts_bp = Blueprint("attempts", __name__, url_prefix="/attempts")


@attempts_bp.post("/<int:attempt_id>/submission")
@login_required
def submit_moves(attempt_id: int) -> tuple[Response, int] | Response:
    data: dict[str, object] = request.get_json(silent=True) or {}
    moves_raw = data.get("moves")
    if not isinstance(moves_raw, list) or not all(isinstance(m, str) for m in moves_raw):
        return jsonify({"error": "moves must be an array of strings"}), 400
    moves: list[str] = [m for m in moves_raw if isinstance(m, str)]
    try:
        run_svc.submit_moves(attempt_id, session["user_id"], moves)
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    except ValueError as e:
        return jsonify({"error": str(e)}), 409
    return Response(status=204)


@attempts_bp.post("/<int:attempt_id>/complete")
@login_required
def complete_attempt(attempt_id: int) -> tuple[Response, int] | Response:
    data: dict[str, object] = request.get_json(silent=True) or {}
    status_raw = data.get("status")
    moves_raw = data.get("moves")

    if status_raw not in ("solved", "failed"):
        return jsonify({"error": "status must be 'solved' or 'failed'"}), 400
    if not isinstance(moves_raw, list) or not all(isinstance(m, str) for m in moves_raw):
        return jsonify({"error": "moves must be an array of strings"}), 400

    status: str = str(status_raw)
    moves: list[str] = [str(m) for m in moves_raw]

    try:
        result = run_svc.complete_attempt(attempt_id, session["user_id"], status, moves)
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    except ValueError as e:
        code = 409 if "already" in str(e) or "not active" in str(e) else 400
        return jsonify({"error": str(e)}), code
    return jsonify(result)
