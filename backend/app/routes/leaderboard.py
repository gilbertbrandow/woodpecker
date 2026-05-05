from flask import Blueprint, Response, jsonify, request

from app.decorators import login_required
from app.services import leaderboard as leaderboard_svc

leaderboard_bp = Blueprint("leaderboard", __name__, url_prefix="/leaderboard")


@leaderboard_bp.get("")
@login_required
def get_leaderboard() -> Response | tuple[Response, int]:
    schedule_id: int | None = None
    raw = request.args.get("scheduleId")
    if raw is not None:
        if not raw.isdigit():
            return jsonify({"error": "scheduleId must be a positive integer"}), 400
        schedule_id = int(raw)
    return jsonify({"runs": leaderboard_svc.get_leaderboard_runs(schedule_id)})
