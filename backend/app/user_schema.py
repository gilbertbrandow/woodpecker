"""Canonical serialization for the active-user API response shape."""
from datetime import datetime, timezone

from app.models.user import User
from app.services.user_ref import PRESENCE_THRESHOLD


def user_to_dict(user: User) -> dict[str, object]:
    last_seen = user.last_seen_at
    if last_seen is not None and last_seen.tzinfo is None:
        last_seen = last_seen.replace(tzinfo=timezone.utc)
    is_present = last_seen is not None and (datetime.now(timezone.utc) - last_seen) < PRESENCE_THRESHOLD
    return {
        "status": "active",
        "id": user.id,
        "username": user.lichess_username,
        "displayName": user.display_name,
        "avatarUrl": user.avatar_url,
        "isPresent": is_present,
        "countryCode": user.country_code,
        "boardTheme": user.board_theme,
        "pieceTheme": user.piece_theme,
        "showTimerTenths": user.show_timer_tenths,
        "soundEnabled": user.sound_enabled,
        "soundTheme": user.sound_theme,
        "opponentMoveDelayMs": user.opponent_move_delay_ms,
        "animationDurationMs": user.animation_duration_ms,
        "isSuperAdmin": user.is_superadmin,
    }
