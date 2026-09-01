import requests as http
from flask import Blueprint, Response, jsonify, request, session

from app.decorators import login_required
from app.extensions import db
from app.models.user import User
from app.services.flags import is_valid_flag
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
    sound_enabled = data.get("soundEnabled")
    sound_theme = data.get("soundTheme")
    opponent_move_delay_ms = data.get("opponentMoveDelayMs")
    animation_duration_ms = data.get("animationDurationMs")

    user = update_user_settings(
        user_id,
        str(display_name) if display_name is not None else None,
        str(avatar_url) if avatar_url is not None else None,
        str(board_theme) if board_theme is not None else None,
        str(piece_theme) if piece_theme is not None else None,
        bool(show_timer_tenths) if show_timer_tenths is not None else None,
        bool(sound_enabled) if sound_enabled is not None else None,
        str(sound_theme) if sound_theme is not None else None,
        int(str(opponent_move_delay_ms)) if opponent_move_delay_ms is not None else None,
        int(str(animation_duration_ms)) if animation_duration_ms is not None else None,
    )
    if "countryCode" in data:
        raw_cc = data["countryCode"]
        user.country_code = raw_cc if isinstance(raw_cc, str) and is_valid_flag(raw_cc) else None
        db.session.commit()
    return jsonify(user_to_dict(user))


@settings_bp.post("/refresh-country")
@login_required
def refresh_country() -> tuple[Response, int] | Response:
    user_id: int = session["user_id"]
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "user not found"}), 404
    try:
        resp = http.get(
            f"https://lichess.org/api/user/{user.lichess_username}",
            headers={"User-Agent": "woodpecker/1.0"},
            timeout=10,
        )
    except http.exceptions.RequestException:
        return jsonify({"title": "Could not reach Lichess", "detail": "Failed to fetch country from your Lichess profile. Try again later."}), 502
    if resp.ok:
        try:
            profile = resp.json().get("profile") or {}
        except ValueError:
            return jsonify({"title": "Lichess error", "detail": "Unexpected response from Lichess API."}), 502
        raw = profile.get("flag") or profile.get("country")
        user.country_code = raw if isinstance(raw, str) and is_valid_flag(raw) else None
        db.session.commit()
    return jsonify(user_to_dict(user))
