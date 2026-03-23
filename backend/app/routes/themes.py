from flask import Blueprint, jsonify, Response

from app.decorators import login_required
from app.services import themes as themes_svc

themes_bp = Blueprint("themes", __name__, url_prefix="/themes")


@themes_bp.get("")
@login_required
def list_themes() -> Response:
    themes = themes_svc.list_themes()
    return jsonify([
        {
            "name": t.name,
            "displayName": t.display_name,
            "description": t.description,
        }
        for t in themes
    ])
