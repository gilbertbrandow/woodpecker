from flask import Blueprint, Response, jsonify, session

from app.decorators import login_required
from app.services import run as run_svc

runs_bp = Blueprint("runs", __name__, url_prefix="/runs")


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


@runs_bp.post("/<int:run_id>/puzzles/<int:run_puzzle_id>/start")
@login_required
def start_puzzle(run_id: int, run_puzzle_id: int) -> tuple[Response, int] | Response:
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
