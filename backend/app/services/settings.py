from app.extensions import db
from app.models.user import User

AVATAR_PIECES = {"bk", "bq", "br", "bb", "bn"}
AVATAR_COLORS = {
    "navy", "sky", "forest", "sage", "amber", "straw", "crimson", "rust",
}

BOARD_THEMES = {
    "blue", "blue2", "brown", "green", "green-plastic", "maple", "wood","wood4",
}

PIECE_SETS = {
    "alpha", "anarcandy", "companion","maestro",
    "merida",
}

DEFAULT_BOARD_THEME = "blue"
DEFAULT_PIECE_SET = "alpha"


def _validate_nickname(value: str) -> str | None:
    stripped = value.strip()
    if not stripped:
        return None
    if len(stripped) > 32:
        raise ValueError("Nickname must be 32 characters or fewer.")
    return stripped


def _validate_avatar_url(value: str) -> str | None:
    if not value:
        return None
    if value.startswith("https://"):
        if len(value) > 512:
            raise ValueError("Avatar URL must be 512 characters or fewer.")
        return value
    if value.startswith("default:"):
        parts = value.split(":")
        if len(parts) != 3:
            raise ValueError("Invalid default avatar format.")
        _, piece, color = parts
        if piece not in AVATAR_PIECES or color not in AVATAR_COLORS:
            raise ValueError("Invalid default avatar piece or color.")
        return value
    raise ValueError("Avatar URL must start with https:// or be a valid default avatar.")


def _validate_board_theme(value: str) -> str:
    if value not in BOARD_THEMES:
        raise ValueError(f"Invalid board theme: {value!r}.")
    return value


def _validate_piece_set(value: str) -> str:
    if value not in PIECE_SETS:
        raise ValueError(f"Invalid piece set: {value!r}.")
    return value


def update_user_settings(
    user_id: int,
    nickname: str | None,
    avatar_url: str | None,
    board_theme: str | None,
    piece_theme: str | None,
) -> User:
    user = db.session.get(User, user_id)
    if not user:
        raise ValueError("User not found.")

    if nickname is not None:
        user.nickname = _validate_nickname(nickname)
    if avatar_url is not None:
        user.avatar_url = _validate_avatar_url(avatar_url)
    if board_theme is not None:
        user.board_theme = _validate_board_theme(board_theme)
    if piece_theme is not None:
        user.piece_theme = _validate_piece_set(piece_theme)

    db.session.commit()
    return user
