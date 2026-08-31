"""Canonical UserRef serialiser — use wherever a user is referenced from another resource."""
from datetime import datetime, timedelta, timezone

from app.models.user import User

PRESENCE_THRESHOLD = timedelta(minutes=5)


def user_ref(user: User) -> dict[str, object]:
    last_seen = user.last_seen_at
    if last_seen is not None and last_seen.tzinfo is None:
        last_seen = last_seen.replace(tzinfo=timezone.utc)
    is_present = last_seen is not None and (datetime.now(timezone.utc) - last_seen) < PRESENCE_THRESHOLD
    return {
        "id": user.id,
        "displayName": user.display_name,
        "avatarUrl": user.avatar_url,
        "isPresent": is_present,
        "countryCode": user.country_code,
    }


def user_ref_from_row(
    user_id: int,
    display_name: str,
    avatar_url: str | None,
    last_seen_at: datetime | None,
    country_code: str | None,
) -> dict[str, object]:
    """Build a UserRef from raw SQL row fields."""
    if last_seen_at is not None and last_seen_at.tzinfo is None:
        last_seen_at = last_seen_at.replace(tzinfo=timezone.utc)
    is_present = last_seen_at is not None and (datetime.now(timezone.utc) - last_seen_at) < PRESENCE_THRESHOLD
    return {
        "id": user_id,
        "displayName": display_name,
        "avatarUrl": avatar_url,
        "isPresent": is_present,
        "countryCode": country_code,
    }
