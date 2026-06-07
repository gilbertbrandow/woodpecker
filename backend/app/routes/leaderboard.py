from flask import Blueprint, Response, jsonify, request, session

from app.decorators import login_required
from app.exceptions import ForbiddenError, NotFoundError
from app.extensions import db
from app.models.training import Training
from app.services import leaderboard as leaderboard_svc

leaderboard_bp = Blueprint("leaderboard", __name__, url_prefix="/leaderboard")


@leaderboard_bp.get("")
@login_required
def get_leaderboard() -> Response | tuple[Response, int]:
    raw_tid = request.args.get("trainingId")
    raw_ri = request.args.get("runIndex")
    raw_sid = request.args.get("scheduleId")

    schedule_id: int | None = None
    run_index: int | None = None

    if raw_tid is not None and raw_ri is not None:
        if not raw_tid.isdigit():
            return jsonify({"error": "trainingId must be a positive integer"}), 400
        if not raw_ri.lstrip("-").isdigit():
            return jsonify({"error": "runIndex must be an integer"}), 400
        training = db.session.get(Training, int(raw_tid))
        if training is None:
            raise NotFoundError("Training not found", "The requested training does not exist.")
        if training.user_id != session["user_id"]:
            raise ForbiddenError("Access denied", "You do not have permission to view this leaderboard.")
        schedule_id = training.schedule_id
        run_index = int(raw_ri)
    elif raw_sid is not None:
        if not raw_sid.isdigit():
            return jsonify({"error": "scheduleId must be a positive integer"}), 400
        schedule_id = int(raw_sid)

    return jsonify({
        "runs": leaderboard_svc.get_run_board(
            schedule_id=schedule_id,
            run_index=run_index,
            exclude_aborted=(run_index is not None),
        )
    })


@leaderboard_bp.get("/weekly")
@login_required
def get_weekly_leaderboard() -> Response | tuple[Response, int]:
    schedule_id: int | None = None
    raw = request.args.get("scheduleId")
    if raw is not None:
        if not raw.isdigit():
            return jsonify({"error": "scheduleId must be a positive integer"}), 400
        schedule_id = int(raw)
    return jsonify({"rows": leaderboard_svc.get_weekly_board(schedule_id)})
