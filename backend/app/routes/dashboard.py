from flask import Blueprint, Response, jsonify, request, session

from app.decorators import login_required
from app.services import dashboard as dashboard_svc

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/dashboard")


@dashboard_bp.get("")
@login_required
def get_dashboard() -> Response:
    training_id: int | None = None
    run_index: int | None = None

    raw_tid = request.args.get("trainingId")
    if raw_tid is not None and raw_tid.lstrip("-").isdigit():
        training_id = int(raw_tid)

    raw_ri = request.args.get("runIndex")
    if raw_ri is not None and raw_ri.lstrip("-").isdigit():
        run_index = int(raw_ri)

    # If only runIndex is provided without trainingId, treat both as absent
    if training_id is None and run_index is not None:
        run_index = None

    tz_str = request.args.get("tz", "UTC")

    return jsonify(
        dashboard_svc.get_dashboard(
            user_id=session["user_id"],
            training_id=training_id,
            run_index=run_index,
            tz_str=tz_str,
        )
    )
