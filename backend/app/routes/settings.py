from flask import Blueprint, jsonify, request, session, Response
from app.decorators import login_required
from app.models.user import User
from app.services.settings import update_user_settings

settings_bp = Blueprint("settings", __name__, url_prefix="/settings")


def _user_to_dict(user: User) -> dict[str, object]:
    return {
        "id": user.id,
        "username": user.lichess_username,
        "nickname": user.nickname,
        "avatarUrl": user.avatar_url,
        "boardTheme": user.board_theme,
        "pieceTheme": user.piece_theme,
    }


@settings_bp.patch("")
@login_required
def patch_settings() -> tuple[Response, int] | Response:
    data: dict[str, object] = request.get_json(silent=True) or {}
    user_id: int = session["user_id"]

    nickname = data.get("nickname")
    avatar_url = data.get("avatarUrl")
    board_theme = data.get("boardTheme")
    piece_theme = data.get("pieceTheme")

    try:
        user = update_user_settings(
            user_id,
            str(nickname) if nickname is not None else None,
            str(avatar_url) if avatar_url is not None else None,
            str(board_theme) if board_theme is not None else None,
            str(piece_theme) if piece_theme is not None else None,
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify(_user_to_dict(user))
