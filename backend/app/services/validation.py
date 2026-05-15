import re

_DISPLAY_NAME_RE = re.compile(r'^[\w\s\-]+$', re.UNICODE)


def validate_display_name(value: str) -> str:
    stripped = value.strip()
    if not stripped:
        raise ValueError("Display name cannot be empty.")
    if len(stripped) < 2:
        raise ValueError("Display name must be at least 2 characters.")
    if len(stripped) > 32:
        raise ValueError("Display name must be 32 characters or fewer.")
    if not _DISPLAY_NAME_RE.match(stripped):
        raise ValueError("Display name may only contain letters, digits, spaces, underscores, and hyphens.")
    return stripped
