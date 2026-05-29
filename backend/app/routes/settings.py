from flask import Blueprint, jsonify, request, session, Response
from app.decorators import login_required
from app.services.settings import update_user_settings
from app.user_schema import user_to_dict

settings_bp = Blueprint("settings", __name__, url_prefix="/settings")


@settings_bp.patch("")
@login_required
def patch_settings() -> tuple[Response, int] | Response:
    data: dict[str, object] = request.get_json(silent=True) or {}
    user_id: int = session["user_id"]

    display_name = data.get("displayName")
    avatar_url = data.get("avatarUrl")
    board_theme = data.get("boardTheme")
    piece_theme = data.get("pieceTheme")
    show_timer_tenths = data.get("showTimerTenths")

    user = update_user_settings(
        user_id,
        str(display_name) if display_name is not None else None,
        str(avatar_url) if avatar_url is not None else None,
        str(board_theme) if board_theme is not None else None,
        str(piece_theme) if piece_theme is not None else None,
        bool(show_timer_tenths) if show_timer_tenths is not None else None,
    )
    return jsonify(user_to_dict(user))
