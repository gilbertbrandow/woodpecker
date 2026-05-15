"""Whitelist management: check, add.

All whitelist operations normalise Lichess usernames to lowercase before
any DB interaction. Callers should not pre-normalise.
"""
from datetime import datetime, timezone

from app.extensions import db
from app.models.user import WhitelistEntry


def is_whitelisted(lichess_username: str) -> bool:
    normalized = lichess_username.lower()
    return (
        db.session.execute(
            db.select(WhitelistEntry).filter_by(lichess_username=normalized)
        ).scalar_one_or_none()
        is not None
    )


def add(lichess_username: str) -> bool:
    """Add a username to the whitelist. Returns True if added, False if already present."""
    normalized = lichess_username.lower()
    if db.session.execute(
        db.select(WhitelistEntry).filter_by(lichess_username=normalized)
    ).scalar_one_or_none():
        return False
    db.session.add(WhitelistEntry(
        lichess_username=normalized,
        created_at=datetime.now(timezone.utc),
    ))
    db.session.commit()
    return True
