import sqlalchemy as sa

from flask import Blueprint, Response, jsonify, request, session

from app.decorators import login_required
from app.exceptions import NotFoundError
from app.extensions import db
from app.models.schedule import Schedule
from app.models.user import User
from app.services import schedule as schedule_svc
from app.table_query import TableQuery
from app.services import training as training_svc

schedules_bp = Blueprint("schedules", __name__, url_prefix="/schedules")


def _load_creator(schedule: Schedule) -> User:
    creator = db.session.get(User, schedule.user_id)
    if creator is None:
        raise NotFoundError("User not found", "The schedule creator's account could not be found.")
    return creator


@schedules_bp.get("/suggest")
@login_required
def suggest_schedules() -> Response:
    limit = min(20, max(1, int(request.args.get("limit", "8"))))
    return jsonify(schedule_svc.suggest_schedules(limit=limit))


@schedules_bp.get("/search")
@login_required
def search_schedules() -> Response:
    q = request.args.get("q", "").strip()
    limit = min(50, max(1, int(request.args.get("limit", "10"))))
    if not q:
        return jsonify([])
    return jsonify(schedule_svc.search_schedules(q, limit=limit))


@schedules_bp.get("/by-ids")
@login_required
def get_schedules_by_ids() -> Response:
    ids_raw = request.args.get("ids", "")
    ids = [int(x) for x in ids_raw.split(",") if x.strip().isdigit()]
    if not ids:
        return jsonify([])
    rows = db.session.scalars(sa.select(Schedule).where(Schedule.id.in_(ids))).all()
    return jsonify([{"id": s.id, "name": s.name, "status": s.status} for s in rows])


@schedules_bp.post("")
@login_required
def create_schedule() -> tuple[Response, int]:
    data: dict[str, object] = request.get_json(silent=True) or {}
    name = data.get("name", "")
    subset_id_raw = data.get("subsetId")
    if not isinstance(name, str):
        return jsonify({"error": "name must be a string"}), 400
    if not isinstance(subset_id_raw, int):
        return jsonify({"error": "subsetId must be an integer"}), 400
    schedule = schedule_svc.create_schedule(session["user_id"], name, subset_id_raw)
    return jsonify(schedule_svc.schedule_to_dict(schedule, _load_creator(schedule))), 201


@schedules_bp.get("")
@login_required
def list_schedules() -> Response:
    q = TableQuery(request)
    result = schedule_svc.list_schedules(
        session["user_id"],
        subset_ids=q.int_filter("subsetId"),
        locked_only=q.flag("locked"),
        status=q.str_filter("status"),
        search=q.q,
        page=q.page,
        page_size=q.page_size,
        user_ids=q.int_filter("userId"),
        date=q.date_filter("date"),
        run_count=q.range_filter("runCount"),
        puzzle_count=q.range_filter("puzzleCount"),
    )
    return jsonify(result)


@schedules_bp.get("/<int:schedule_id>")
@login_required
def get_schedule(schedule_id: int) -> tuple[Response, int] | Response:
    schedule = schedule_svc.get_schedule(schedule_id, session["user_id"])
    return jsonify(schedule_svc.schedule_to_dict(schedule, _load_creator(schedule)))


@schedules_bp.patch("/<int:schedule_id>")
@login_required
def update_schedule(schedule_id: int) -> tuple[Response, int] | Response:
    updates: dict[str, object] = request.get_json(silent=True) or {}
    schedule = schedule_svc.update_schedule(schedule_id, session["user_id"], updates)
    return jsonify(schedule_svc.schedule_to_dict(schedule, _load_creator(schedule)))


@schedules_bp.delete("/<int:schedule_id>")
@login_required
def delete_schedule(schedule_id: int) -> tuple[Response, int]:
    schedule_svc.delete_schedule(schedule_id, session["user_id"])
    return jsonify({}), 204


@schedules_bp.get("/<int:schedule_id>/insights")
@login_required
def get_schedule_insights(schedule_id: int) -> tuple[Response, int] | Response:
    data = schedule_svc.get_schedule_insights(schedule_id, session["user_id"])
    return jsonify({"data": data})


@schedules_bp.get("/<int:schedule_id>/training/me")
@login_required
def get_my_training_for_schedule(schedule_id: int) -> tuple[Response, int] | Response:
    training = training_svc.get_my_training_for_schedule(
        schedule_id, session["user_id"]
    )
    if training is None:
        return jsonify({"training": None})
    return jsonify({"training": {
        "id": training.id,
        "scheduleId": training.schedule_id,
        "status": training_svc.training_status(training),
        "startedAt": training.started_at.isoformat(),
        "completedAt": training.completed_at.isoformat() if training.completed_at else None,
        "abortedAt": training.aborted_at.isoformat() if training.aborted_at else None,
    }})


@schedules_bp.get("/<int:schedule_id>/training/participants")
@login_required
def get_schedule_participants(schedule_id: int) -> tuple[Response, int] | Response:
    result = training_svc.get_schedule_participants(schedule_id, session["user_id"])
    return jsonify(result)


@schedules_bp.get("/<int:schedule_id>/training-insights")
@login_required
def get_training_insights(schedule_id: int) -> tuple[Response, int] | Response:
    runs_raw = request.args.get("runs", "")
    participants_raw = request.args.get("participants", "")
    try:
        run_indices = [int(r) for r in runs_raw.split(",") if r.strip()] if runs_raw else []
        participant_ids = (
            [int(p) for p in participants_raw.split(",") if p.strip()]
            if participants_raw
            else []
        )
    except ValueError:
        return jsonify({"error": "Invalid runs or participants parameter."}), 400
    result = training_svc.get_training_insights(
        schedule_id, session["user_id"], run_indices, participant_ids
    )
    return jsonify(result)


@schedules_bp.post("/<int:schedule_id>/lock")
@login_required
def lock_schedule(schedule_id: int) -> tuple[Response, int] | Response:
    schedule = schedule_svc.lock_schedule(schedule_id, session["user_id"])
    return jsonify(schedule_svc.schedule_to_dict(schedule, _load_creator(schedule)))
