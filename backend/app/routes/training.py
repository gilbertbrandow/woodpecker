from flask import Blueprint, Response, jsonify, request, session

from app.decorators import login_required
from app.services import run as run_svc
from app.services import training as training_svc

training_bp = Blueprint("training", __name__, url_prefix="/training")


@training_bp.post("")
@login_required
def create_training() -> tuple[Response, int]:
    data: dict[str, object] = request.get_json(silent=True) or {}
    schedule_id_raw = data.get("scheduleId")
    if not isinstance(schedule_id_raw, int):
        return jsonify({"error": "scheduleId must be an integer"}), 400
    try:
        training = training_svc.create_training(session["user_id"], schedule_id_raw)
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except ValueError as e:
        status_code = 409 if "Already enrolled" in str(e) else 400
        return jsonify({"error": str(e)}), status_code
    return jsonify(training_svc.training_full_dict(training)), 201


@training_bp.get("")
@login_required
def list_my_trainings() -> Response:
    tz_str = request.args.get("tz", "UTC")
    return jsonify(training_svc.list_my_trainings(session["user_id"], tz_str=tz_str))


@training_bp.get("/all")
@login_required
def list_all_trainings() -> Response:
    schedule_id_raw = request.args.get("scheduleId")
    schedule_id = int(schedule_id_raw) if schedule_id_raw and schedule_id_raw.isdigit() else None
    user_ids = [int(v) for v in request.args.getlist("userId") if v.isdigit()]
    statuses = request.args.getlist("status") or None
    page_raw = request.args.get("page", "1")
    page_size_raw = request.args.get("pageSize", "20")
    page = max(1, int(page_raw)) if page_raw.isdigit() else 1
    page_size = min(100, max(1, int(page_size_raw))) if page_size_raw.isdigit() else 20
    return jsonify(training_svc.list_all_trainings(
        schedule_id=schedule_id,
        user_ids=user_ids or None,
        statuses=statuses,
        page=page,
        page_size=page_size,
    ))


@training_bp.get("/<int:training_id>")
@login_required
def get_training(training_id: int) -> tuple[Response, int] | Response:
    try:
        training = training_svc.get_training(training_id)
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    try:
        result = training_svc.training_full_dict(training)
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    return jsonify(result)


@training_bp.put("/<int:training_id>/run-targets/<int:run_index>")
@login_required
def set_run_target(training_id: int, run_index: int) -> tuple[Response, int] | Response:
    data: dict[str, object] = request.get_json(silent=True) or {}
    target_accuracy_raw = data.get("targetAccuracy")
    target_solve_seconds_raw = data.get("targetSolveSeconds")

    if target_accuracy_raw is not None and not isinstance(target_accuracy_raw, (int, float)):
        return jsonify({"error": "targetAccuracy must be a number or null"}), 400
    if target_solve_seconds_raw is not None and not isinstance(target_solve_seconds_raw, int):
        return jsonify({"error": "targetSolveSeconds must be an integer or null"}), 400

    target_accuracy = float(target_accuracy_raw) if target_accuracy_raw is not None else None

    try:
        target = training_svc.set_run_target(
            training_id,
            session["user_id"],
            run_index,
            target_accuracy,
            target_solve_seconds_raw if isinstance(target_solve_seconds_raw, int) else None,
        )
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({
        "runIndex": target.run_index,
        "targetAccuracy": target.target_accuracy,
        "targetSolveSeconds": target.target_solve_seconds,
    })


@training_bp.post("/<int:training_id>/runs")
@login_required
def start_run(training_id: int) -> tuple[Response, int]:
    data: dict[str, object] = request.get_json(silent=True) or {}
    run_index_raw = data.get("runIndex")
    if run_index_raw is not None and not isinstance(run_index_raw, int):
        return jsonify({"error": "runIndex must be an integer"}), 400

    try:
        run = run_svc.start_run(
            training_id,
            session["user_id"],
            run_index_raw if isinstance(run_index_raw, int) else None,
        )
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    except ValueError as e:
        code = 409 if "active run" in str(e) else 400
        return jsonify({"error": str(e)}), code
    return jsonify(run_svc.run_dict(run)), 201


@training_bp.get("/<int:training_id>/runs")
@login_required
def list_runs(training_id: int) -> tuple[Response, int] | Response:
    try:
        runs = run_svc.list_runs(training_id)
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    return jsonify([run_svc.run_dict(r) for r in runs])


@training_bp.get("/<int:training_id>/cross-run-item/<int:training_item_id>")
@login_required
def get_cross_run_item(training_id: int, training_item_id: int) -> tuple[Response, int] | Response:
    try:
        result = training_svc.get_cross_run_item_refs(
            training_id, training_item_id, session["user_id"]
        )
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    return jsonify(result)


@training_bp.get("/<int:training_id>/insights")
@login_required
def get_training_insights(training_id: int) -> tuple[Response, int] | Response:
    try:
        runs = training_svc.get_training_run_solve_times(training_id)
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    return jsonify({"runs": runs})


@training_bp.post("/<int:training_id>/abort")
@login_required
def abort_training(training_id: int) -> tuple[Response, int] | Response:
    try:
        training = training_svc.abort_training(training_id, session["user_id"])
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    except ValueError as e:
        status_code = 409 if "terminal" in str(e) else 400
        return jsonify({"error": str(e)}), status_code
    try:
        result = training_svc.training_full_dict(training)
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    return jsonify(result)
