from flask import Blueprint, jsonify, request, Response

from app.decorators import login_required
from app.services import openings as openings_svc

openings_bp = Blueprint("openings", __name__, url_prefix="/openings")


@openings_bp.get("")
@login_required
def search_openings() -> Response:
    query = request.args.get("q", "")
    openings = openings_svc.search_openings(query)
    return jsonify([
        {
            "name": o.name,
            "displayName": o.display_name,
            "eco": o.eco,
        }
        for o in openings
    ])
