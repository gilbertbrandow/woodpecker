from flask import Blueprint, Response, jsonify, request, session

from app.decorators import login_required
from app.services import training_items as training_items_svc
from app.table_query import TableQuery

training_items_bp = Blueprint("training_items", __name__, url_prefix="/training-items")


@training_items_bp.get("/<int:training_item_id>/attempt-history")
@login_required
def get_attempt_history(training_item_id: int) -> tuple[Response, int] | Response:
    q = TableQuery(request)
    result = training_items_svc.get_attempt_history(
        training_item_id,
        session["user_id"],
        page=q.page,
        page_size=q.page_size,
        user_ids=q.int_filter("userId"),
        result=q.str_filter("result"),
    )
    return jsonify(result)


@training_items_bp.get("/<int:training_item_id>/attempts/<int:attempt_id>")
@login_required
def get_spectate_view(training_item_id: int, attempt_id: int) -> tuple[Response, int] | Response:
    result = training_items_svc.get_spectate_view(training_item_id, attempt_id, session["user_id"])
    return jsonify(result)
