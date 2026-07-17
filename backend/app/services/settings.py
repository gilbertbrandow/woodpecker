from app.exceptions import NotFoundError
from app.extensions import db
from app.models.user import User
from app.services.validation import (
    validate_display_name,
    validate_avatar_url,
    validate_board_theme,
    validate_piece_set,
    validate_sound_theme,
)


def update_user_settings(
    user_id: int,
    display_name: str | None,
    avatar_url: str | None,
    board_theme: str | None,
    piece_theme: str | None,
    show_timer_tenths: bool | None = None,
    sound_enabled: bool | None = None,
    sound_theme: str | None = None,
) -> User:
    user = db.session.get(User, user_id)
    if not user:
        raise NotFoundError("User not found", "The requested user account could not be found.")

    if display_name is not None:
        user.display_name = validate_display_name(display_name)
    if avatar_url is not None:
        user.avatar_url = validate_avatar_url(avatar_url)
    if board_theme is not None:
        user.board_theme = validate_board_theme(board_theme)
    if piece_theme is not None:
        user.piece_theme = validate_piece_set(piece_theme)
    if show_timer_tenths is not None:
        user.show_timer_tenths = show_timer_tenths
    if sound_enabled is not None:
        user.sound_enabled = sound_enabled
    if sound_theme is not None:
        user.sound_theme = validate_sound_theme(sound_theme)

    db.session.commit()
    return user
