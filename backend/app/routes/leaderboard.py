from flask import Blueprint, Response, jsonify, request, session

from app.decorators import login_required
from app.services import leaderboard as leaderboard_svc

leaderboard_bp = Blueprint("leaderboard", __name__, url_prefix="/leaderboard")


@leaderboard_bp.get("")
@login_required
def get_leaderboard() -> Response | tuple[Response, int]:
    raw_tid = request.args.get("trainingId")
    raw_ri = request.args.get("runIndex")

    if raw_tid is not None and raw_ri is not None:
        if not raw_tid.isdigit():
            return jsonify({"error": "trainingId must be a positive integer"}), 400
        if not raw_ri.lstrip("-").isdigit():
            return jsonify({"error": "runIndex must be an integer"}), 400
        return jsonify({
            "runs": leaderboard_svc.get_run_leaderboard(
                int(raw_tid), int(raw_ri), session["user_id"]
            )
        })

    schedule_id: int | None = None
    raw = request.args.get("scheduleId")
    if raw is not None:
        if not raw.isdigit():
            return jsonify({"error": "scheduleId must be a positive integer"}), 400
        schedule_id = int(raw)
    return jsonify({"runs": leaderboard_svc.get_leaderboard_runs(schedule_id)})
