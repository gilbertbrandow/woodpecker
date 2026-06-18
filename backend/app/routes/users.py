from flask import Blueprint, Response, jsonify, request

from app.decorators import login_required
from app.services import user as user_svc

users_bp = Blueprint("users", __name__, url_prefix="/users")


@users_bp.get("/by-ids")
@login_required
def get_users_by_ids() -> Response:
    ids_raw = request.args.get("ids", "")
    ids = [int(x) for x in ids_raw.split(",") if x.strip().isdigit()]
    return jsonify(user_svc.get_users_by_ids(ids))


@users_bp.get("/search")
@login_required
def search_users() -> Response:
    q = request.args.get("q", "").strip()
    if len(q) < 2:
        return jsonify([])
    limit_raw = request.args.get("limit", "10")
    limit = min(50, max(1, int(limit_raw))) if limit_raw.isdigit() else 10
    return jsonify(user_svc.search_users(q, limit=limit))
