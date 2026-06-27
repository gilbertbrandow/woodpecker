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
        "isSuperAdmin": True,  # TODO: use user.is_superadmin after migration i2j3k4l5m6n7 is applied to prod
    }
