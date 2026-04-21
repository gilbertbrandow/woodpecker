from flask import Blueprint, Response, jsonify, request, session

from app.decorators import login_required
from app.extensions import db
from app.models.schedule import Schedule
from app.models.user import User
from app.services import schedule as schedule_svc
from app.services import schedule_participation as participation_svc

schedules_bp = Blueprint("schedules", __name__, url_prefix="/schedules")


def _load_creator(schedule: Schedule) -> User:
    creator = db.session.get(User, schedule.user_id)
    if creator is None:
        raise LookupError("Schedule creator not found.")
    return creator


def _schedule_to_dict(schedule: Schedule, creator: User) -> dict[str, object]:
    config = schedule.config
    total_hours = schedule_svc.compute_total_hours(config) if config else 0
    return {
        "id": schedule.id,
        "name": schedule.name,
        "description": schedule.description,
        "subsetId": schedule.subset_id,
        "status": schedule.status,
        "config": config,
        "totalHours": total_hours,
        "createdBy": {"username": creator.lichess_username, "avatarUrl": creator.avatar_url},
        "createdAt": schedule.created_at.isoformat(),
        "lockedAt": schedule.locked_at.isoformat() if schedule.locked_at else None,
    }


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
    try:
        schedule = schedule_svc.create_schedule(session["user_id"], name, subset_id_raw)
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(_schedule_to_dict(schedule, _load_creator(schedule))), 201


@schedules_bp.get("")
@login_required
def list_schedules() -> Response:
    subset_id_raw = request.args.get("subsetId")
    subset_id = int(subset_id_raw) if subset_id_raw and subset_id_raw.isdigit() else None
    schedules = schedule_svc.list_schedules(session["user_id"], subset_id=subset_id)
    return jsonify(schedules)


@schedules_bp.get("/<int:schedule_id>")
@login_required
def get_schedule(schedule_id: int) -> tuple[Response, int] | Response:
    try:
        schedule = schedule_svc.get_schedule(schedule_id, session["user_id"])
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    return jsonify(_schedule_to_dict(schedule, _load_creator(schedule)))


@schedules_bp.patch("/<int:schedule_id>")
@login_required
def update_schedule(schedule_id: int) -> tuple[Response, int] | Response:
    updates: dict[str, object] = request.get_json(silent=True) or {}
    try:
        schedule = schedule_svc.update_schedule(schedule_id, session["user_id"], updates)
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(_schedule_to_dict(schedule, _load_creator(schedule)))


@schedules_bp.delete("/<int:schedule_id>")
@login_required
def delete_schedule(schedule_id: int) -> tuple[Response, int]:
    try:
        schedule_svc.delete_schedule(schedule_id, session["user_id"])
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    return jsonify({}), 204


@schedules_bp.get("/<int:schedule_id>/insights")
@login_required
def get_schedule_insights(schedule_id: int) -> tuple[Response, int] | Response:
    try:
        data = schedule_svc.get_schedule_insights(schedule_id, session["user_id"])
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    return jsonify({"data": data})


@schedules_bp.get("/<int:schedule_id>/participations/me")
@login_required
def get_my_participation_for_schedule(schedule_id: int) -> tuple[Response, int] | Response:
    participation = participation_svc.get_my_participation_for_schedule(
        schedule_id, session["user_id"]
    )
    if participation is None:
        return jsonify({"error": "Not enrolled."}), 404
    return jsonify({
        "id": participation.id,
        "scheduleId": participation.schedule_id,
        "status": participation_svc.participation_status(participation),
        "startedAt": participation.started_at.isoformat(),
        "completedAt": participation.completed_at.isoformat() if participation.completed_at else None,
        "abortedAt": participation.aborted_at.isoformat() if participation.aborted_at else None,
    })


@schedules_bp.get("/<int:schedule_id>/participations")
@login_required
def get_schedule_participants(schedule_id: int) -> tuple[Response, int] | Response:
    try:
        result = participation_svc.get_schedule_participants(schedule_id, session["user_id"])
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    return jsonify(result)


@schedules_bp.get("/<int:schedule_id>/participation-insights")
@login_required
def get_participation_insights(schedule_id: int) -> tuple[Response, int] | Response:
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
    try:
        result = participation_svc.get_participation_insights(
            schedule_id, session["user_id"], run_indices, participant_ids
        )
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(result)


@schedules_bp.post("/<int:schedule_id>/lock")
@login_required
def lock_schedule(schedule_id: int) -> tuple[Response, int] | Response:
    try:
        schedule = schedule_svc.lock_schedule(schedule_id, session["user_id"])
    except LookupError as e:
        return jsonify({"error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    except ValueError as e:
        status_code = 409 if "Already locked" in str(e) else 400
        return jsonify({"error": str(e)}), status_code
    return jsonify(_schedule_to_dict(schedule, _load_creator(schedule)))
