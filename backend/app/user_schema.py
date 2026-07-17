"""Canonical serialization for the active-user API response shape."""
from app.models.user import User


def user_to_dict(user: User) -> dict[str, object]:
    return {
        "status": "active",
        "id": user.id,
        "username": user.lichess_username,
        "displayName": user.display_name,
        "avatarUrl": user.avatar_url,
        "boardTheme": user.board_theme,
        "pieceTheme": user.piece_theme,
        "showTimerTenths": user.show_timer_tenths,
        "soundEnabled": user.sound_enabled,
        "soundTheme": user.sound_theme,
        "isSuperAdmin": user.is_superadmin,
    }
