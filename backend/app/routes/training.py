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
    training = training_svc.create_training(session["user_id"], schedule_id_raw)
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
    search = request.args.get("search") or None
    page_raw = request.args.get("page", "1")
    page_size_raw = request.args.get("pageSize", "20")
    page = max(1, int(page_raw)) if page_raw.isdigit() else 1
    page_size = min(100, max(1, int(page_size_raw))) if page_size_raw.isdigit() else 20
    tz_str = request.args.get("tz", "UTC")
    return jsonify(training_svc.list_all_trainings(
        schedule_id=schedule_id,
        user_ids=user_ids or None,
        statuses=statuses,
        search=search,
        page=page,
        page_size=page_size,
        tz_str=tz_str,
    ))


@training_bp.get("/<int:training_id>")
@login_required
def get_training(training_id: int) -> tuple[Response, int] | Response:
    training = training_svc.get_training(training_id)
    return jsonify(training_svc.training_full_dict(training))


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
    target = training_svc.set_run_target(
        training_id,
        session["user_id"],
        run_index,
        target_accuracy,
        target_solve_seconds_raw if isinstance(target_solve_seconds_raw, int) else None,
    )
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
    run = run_svc.start_run(
        training_id,
        session["user_id"],
        run_index_raw if isinstance(run_index_raw, int) else None,
    )
    return jsonify(run_svc.run_dict(run)), 201


@training_bp.get("/<int:training_id>/runs")
@login_required
def list_runs(training_id: int) -> tuple[Response, int] | Response:
    runs = run_svc.list_runs(training_id)
    return jsonify([run_svc.run_dict(r) for r in runs])


@training_bp.get("/<int:training_id>/cross-run-item/<int:training_item_id>")
@login_required
def get_cross_run_item(training_id: int, training_item_id: int) -> tuple[Response, int] | Response:
    result = training_svc.get_cross_run_item_refs(
        training_id, training_item_id, session["user_id"]
    )
    return jsonify(result)


@training_bp.get("/<int:training_id>/progress")
@login_required
def get_training_progress(training_id: int) -> tuple[Response, int] | Response:
    return jsonify(training_svc.get_training_progress(training_id, session["user_id"]))


@training_bp.get("/<int:training_id>/status")
@login_required
def get_training_detail_status(training_id: int) -> tuple[Response, int] | Response:
    tz_str = request.args.get("tz", "UTC")
    return jsonify(training_svc.get_training_detail_status(training_id, session["user_id"], tz_str))


@training_bp.get("/<int:training_id>/insights")
@login_required
def get_training_insights(training_id: int) -> tuple[Response, int] | Response:
    runs = training_svc.get_training_run_solve_times(training_id)
    return jsonify({"runs": runs})


@training_bp.post("/<int:training_id>/abort")
@login_required
def abort_training(training_id: int) -> tuple[Response, int] | Response:
    training = training_svc.abort_training(training_id, session["user_id"])
    return jsonify(training_svc.training_full_dict(training))
