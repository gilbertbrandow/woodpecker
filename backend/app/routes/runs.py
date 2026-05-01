from flask import Blueprint, Response, jsonify, request, session

from app.decorators import login_required
from app.services import run as run_svc

runs_bp = Blueprint("runs", __name__, url_prefix="/runs")


@runs_bp.get("/active")
@login_required
def get_active_run() -> tuple[Response, int] | Response:
    result = run_svc.get_active_run_summary(session["user_id"])
    return jsonify(result)


@runs_bp.get("/<int:run_id>")
@login_required
def get_run(run_id: int) -> tuple[Response, int] | Response:
    try:
        run = run_svc.get_run(run_id, session["user_id"])
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    return jsonify(run_svc.run_dict(run))


@runs_bp.post("/<int:run_id>/continue")
@login_required
def continue_run(run_id: int) -> tuple[Response, int] | Response:
    try:
        result = run_svc.continue_run(run_id, session["user_id"])
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    except ValueError as e:
        code = 409 if "not active" in str(e) or "already" in str(e) else 400
        return jsonify({"error": str(e)}), code
    return jsonify(result)


@runs_bp.get("/<int:run_id>/puzzles")
@login_required
def list_run_puzzles(run_id: int) -> tuple[Response, int] | Response:
    try:
        result = run_svc.list_run_puzzles(run_id, session["user_id"])
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    return jsonify(result)


@runs_bp.get("/<int:run_id>/puzzles/<int:run_puzzle_id>")
@login_required
def get_run_puzzle(run_id: int, run_puzzle_id: int) -> tuple[Response, int] | Response:
    try:
        result = run_svc.get_run_puzzle(run_id, run_puzzle_id, session["user_id"])
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    return jsonify(result)


@runs_bp.get("/<int:run_id>/puzzles/<int:run_puzzle_id>/overview")
@login_required
def get_run_puzzle_overview(run_id: int, run_puzzle_id: int) -> tuple[Response, int] | Response:
    selected_attempt_id = request.args.get("attempt", type=int)
    try:
        result = run_svc.get_run_puzzle_overview(
            run_id, run_puzzle_id, session["user_id"], selected_attempt_id
        )
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    return jsonify(result)


@runs_bp.post("/<int:run_id>/puzzles/<int:run_puzzle_id>/attempts")
@login_required
def start_attempt(run_id: int, run_puzzle_id: int) -> tuple[Response, int] | Response:
    try:
        result = run_svc.start_puzzle(run_id, run_puzzle_id, session["user_id"])
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    except ValueError as e:
        code = 409 if "already" in str(e) or "not active" in str(e) else 400
        return jsonify({"error": str(e)}), code
    return jsonify(result)


@runs_bp.post("/<int:run_id>/puzzles/<int:run_puzzle_id>/attempts/<int:attempt_id>/complete")
@login_required
def complete_run_attempt(
    run_id: int, run_puzzle_id: int, attempt_id: int
) -> tuple[Response, int] | Response:
    data: dict[str, object] = request.get_json(silent=True) or {}
    uci_moves_raw = data.get("uciMoves")

    if not isinstance(uci_moves_raw, list) or not all(isinstance(m, str) for m in uci_moves_raw):
        return jsonify({"error": "uciMoves must be an array of strings"}), 400

    uci_moves: list[str] = [str(m) for m in uci_moves_raw]

    client_time_ms_raw = data.get("clientTimeSpentMs")
    client_time_ms: int | None = (
        int(client_time_ms_raw)
        if isinstance(client_time_ms_raw, int) and client_time_ms_raw >= 0
        else None
    )

    try:
        result = run_svc.complete_attempt(attempt_id, session["user_id"], run_id, run_puzzle_id, uci_moves, client_time_ms)
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    except ValueError as e:
        code = 409 if "already" in str(e) or "not active" in str(e) else 400
        return jsonify({"error": str(e)}), code
    return jsonify(result)


@runs_bp.get("/<int:run_id>/puzzles/<int:run_puzzle_id>/attempts/<int:attempt_id>")
@login_required
def get_attempt(
    run_id: int, run_puzzle_id: int, attempt_id: int
) -> tuple[Response, int] | Response:
    try:
        result = run_svc.get_attempt(run_id, run_puzzle_id, attempt_id, session["user_id"])
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    return jsonify(result)


@runs_bp.get("/<int:run_id>/puzzles/<puzzle_id>/history")
@login_required
def get_puzzle_history(run_id: int, puzzle_id: str) -> tuple[Response, int] | Response:
    try:
        result = run_svc.get_puzzle_history(run_id, puzzle_id, session["user_id"])
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    return jsonify(result)


@runs_bp.post("/<int:run_id>/abort")
@login_required
def abort_run(run_id: int) -> tuple[Response, int] | Response:
    try:
        run = run_svc.abort_run(run_id, session["user_id"])
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    except ValueError as e:
        code = 409 if "terminal" in str(e) else 400
        return jsonify({"error": str(e)}), code
    return jsonify(run_svc.run_dict(run))
