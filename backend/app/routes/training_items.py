from flask import Blueprint, Response, jsonify, request, session

from app.decorators import login_required
from app.exceptions import ValidationError
from app.services import training_items as training_items_svc
from app.utils import parse_multi_filter

training_items_bp = Blueprint("training_items", __name__, url_prefix="/training-items")


@training_items_bp.get("/<int:training_item_id>/attempt-history")
@login_required
def get_attempt_history(training_item_id: int) -> tuple[Response, int] | Response:
    page = max(1, request.args.get("page", 1, type=int) or 1)
    page_size = min(100, max(1, request.args.get("pageSize", 20, type=int) or 20))
    user_ids_op, user_ids_vals = parse_multi_filter(request.args.getlist("userId"))
    if user_ids_vals and not all(uid.isdigit() for uid in user_ids_vals):
        raise ValidationError("Invalid parameter", "userId must be a positive integer.")
    user_ids = [int(uid) for uid in user_ids_vals] or None
    _, result_vals = parse_multi_filter(request.args.getlist("result"))
    result_values = result_vals or None
    result = training_items_svc.get_attempt_history(
        training_item_id,
        session["user_id"],
        page=page,
        page_size=page_size,
        user_ids=user_ids,
        user_ids_op=user_ids_op,
        result_filter=result_values,
    )
    return jsonify(result)


@training_items_bp.get("/<int:training_item_id>/attempts/<int:attempt_id>")
@login_required
def get_spectate_view(training_item_id: int, attempt_id: int) -> tuple[Response, int] | Response:
    result = training_items_svc.get_spectate_view(training_item_id, attempt_id, session["user_id"])
    return jsonify(result)
