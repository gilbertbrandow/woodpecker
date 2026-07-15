from flask import Blueprint, Response, jsonify, request, session

from app.decorators import login_required
from app.exceptions import ForbiddenError, NotFoundError
from app.extensions import db
from app.models.training import Training
from app.services import leaderboard as leaderboard_svc
from app.table_query import FilterList, TableQuery

leaderboard_bp = Blueprint("leaderboard", __name__, url_prefix="/leaderboard")


@leaderboard_bp.get("")
@login_required
def get_leaderboard() -> Response | tuple[Response, int]:
    q = TableQuery(request)

    schedule_filter = q.int_filter("scheduleId")
    user_filter = q.int_filter("userId")
    status_filter = q.str_filter("status")
    run_index: int | None = None
    exclude_aborted = False

    # trainingId + runIndex context: pin to that training's schedule
    raw_tid = request.args.get("trainingId")
    raw_ri = request.args.get("runIndex")
    if raw_tid is not None and raw_ri is not None:
        if not raw_tid.isdigit():
            return jsonify({"error": "trainingId must be a positive integer"}), 400
        try:
            run_index = int(raw_ri)
        except ValueError:
            return jsonify({"error": "runIndex must be an integer"}), 400
        training = db.session.get(Training, int(raw_tid))
        if training is None:
            raise NotFoundError("Training not found", "The requested training does not exist.")
        if training.user_id != session["user_id"]:
            raise ForbiddenError("Access denied", "You do not have permission to view this leaderboard.")
        schedule_filter = FilterList(op='is', int_values=[training.schedule_id])
        exclude_aborted = True

    items, total = leaderboard_svc.get_run_board(
        schedule_filter=schedule_filter,
        user_filter=user_filter,
        status_filter=status_filter,
        run_index=run_index,
        exclude_aborted=exclude_aborted,
        search=q.q,
        page=q.page,
        page_size=q.page_size,
    )
    return jsonify({"items": items, "total": total})


@leaderboard_bp.get("/weekly")
@login_required
def get_weekly_leaderboard() -> Response | tuple[Response, int]:
    q = TableQuery(request)
    items, total = leaderboard_svc.get_weekly_board(
        schedule_filter=q.int_filter("scheduleId"),
        user_filter=q.int_filter("userId"),
        search=q.q,
        page=q.page,
        page_size=q.page_size,
    )
    return jsonify({"items": items, "total": total})
