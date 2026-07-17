"""All user-input validators for the Woodpecker API.

Each function accepts a raw string, returns the cleaned/validated value,
or raises ValidationError with a user-readable message.
"""
import re

from app.exceptions import ValidationError

_DISPLAY_NAME_RE = re.compile(r'^[\w\s\-]+$', re.UNICODE)
_EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')

AVATAR_PIECES = {"bk", "bq", "br", "bb", "bn"}
AVATAR_COLORS = {"navy", "sky", "forest", "sage", "amber", "straw", "crimson", "rust"}
BOARD_THEMES = {"blue", "blue2", "brown", "green", "green-plastic", "maple", "wood", "wood4"}
PIECE_SETS = {"alpha", "anarcandy", "companion", "maestro", "merida"}
SOUND_THEMES = {"standard", "piano", "robot", "woodland", "futuristic", "nes", "sfx"}


def validate_email(value: str) -> str:
    stripped = value.strip()
    if not _EMAIL_RE.match(stripped):
        raise ValidationError("Invalid email", "Please enter a valid email address.")
    return stripped


def validate_display_name(value: str) -> str:
    stripped = value.strip()
    if not stripped:
        raise ValidationError("Display name required", "Please enter a display name.")
    if len(stripped) < 2:
        raise ValidationError("Display name too short", "Your display name must be at least 2 characters long.")
    if len(stripped) > 32:
        raise ValidationError("Display name too long", "Your display name must be 32 characters or fewer.")
    if not _DISPLAY_NAME_RE.match(stripped):
        raise ValidationError("Invalid display name", "Display names may only contain letters, digits, spaces, underscores, and hyphens.")
    return stripped


def validate_avatar_url(value: str) -> str | None:
    if not value:
        return None
    if value.startswith("https://"):
        if len(value) > 512:
            raise ValidationError("Avatar URL too long", "The avatar URL must be 512 characters or fewer.")
        return value
    if value.startswith("default:"):
        parts = value.split(":")
        if len(parts) not in (3, 4):
            raise ValidationError("Invalid avatar", "The avatar URL is not in a recognised format.")
        piece = parts[1]
        color = parts[2]
        style = parts[3] if len(parts) == 4 else "alpha"
        if piece not in AVATAR_PIECES or color not in AVATAR_COLORS:
            raise ValidationError("Invalid avatar", "The avatar piece or colour is not valid.")
        if style not in PIECE_SETS:
            raise ValidationError("Invalid avatar", "The avatar style is not valid.")
        return value
    raise ValidationError("Invalid avatar URL", "The avatar URL must start with https:// or be a valid default avatar.")


def validate_board_theme(value: str) -> str:
    if value not in BOARD_THEMES:
        raise ValidationError("Invalid board theme", f"The board theme {value!r} is not recognised.")
    return value


def validate_piece_set(value: str) -> str:
    if value not in PIECE_SETS:
        raise ValidationError("Invalid piece set", f"The piece set {value!r} is not recognised.")
    return value


def validate_sound_theme(value: str) -> str:
    if value not in SOUND_THEMES:
        raise ValidationError("Invalid sound theme", f"The sound theme {value!r} is not recognised.")
    return value
