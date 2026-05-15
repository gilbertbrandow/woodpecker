from flask import Blueprint, jsonify, request, session, Response
from app.decorators import login_required
from app.models.user import User
from app.services.settings import update_user_settings

settings_bp = Blueprint("settings", __name__, url_prefix="/settings")


def _user_to_dict(user: User) -> dict[str, object]:
    return {
        "status": "active",
        "id": user.id,
        "username": user.lichess_username,
        "displayName": user.display_name,
        "avatarUrl": user.avatar_url,
        "boardTheme": user.board_theme,
        "pieceTheme": user.piece_theme,
        "showTimerTenths": user.show_timer_tenths,
    }


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

    try:
        user = update_user_settings(
            user_id,
            str(display_name) if display_name is not None else None,
            str(avatar_url) if avatar_url is not None else None,
            str(board_theme) if board_theme is not None else None,
            str(piece_theme) if piece_theme is not None else None,
            bool(show_timer_tenths) if show_timer_tenths is not None else None,
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify(_user_to_dict(user))
