import os
import hashlib
import base64
import urllib.parse
from datetime import datetime, timezone

import berserk
import requests as http
import sqlalchemy as sa

from app.extensions import db
from app.models.user import User, WaitlistEntry, WhitelistEntry

LICHESS_CLIENT_ID = os.environ.get("LICHESS_CLIENT_ID", "woodpecker")
LICHESS_OAUTH_URL = "https://lichess.org/oauth"
LICHESS_TOKEN_URL = "https://lichess.org/api/token"


def generate_pkce_pair() -> tuple[str, str]:
    verifier = base64.urlsafe_b64encode(os.urandom(32)).rstrip(b"=").decode()
    digest = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return verifier, challenge


def build_lichess_auth_url(challenge: str, redirect_uri: str) -> str:
    params = urllib.parse.urlencode({
        "response_type": "code",
        "client_id": LICHESS_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "scope": "preference:read email:read",
        "code_challenge_method": "S256",
        "code_challenge": challenge,
    })
    return f"{LICHESS_OAUTH_URL}?{params}"


def exchange_code_for_token(code: str, verifier: str, redirect_uri: str) -> str | None:
    response = http.post(LICHESS_TOKEN_URL, json={
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri,
        "client_id": LICHESS_CLIENT_ID,
        "code": code,
        "code_verifier": verifier,
    })
    if not response.ok:
        return None
    return response.json().get("access_token")


def _get_max_users() -> int:
    try:
        return int(os.environ.get("MAX_USERS", "0"))
    except ValueError:
        return 0


def get_or_create_user(access_token: str) -> dict[str, object]:
    lichess_session = berserk.TokenSession(access_token)
    client = berserk.Client(session=lichess_session)
    account = client.account.get()
    lichess_username: str = account["username"].lower()
    avatar_url: str | None = account.get("avatar")

    existing = db.session.execute(
        db.select(User).filter_by(lichess_username=lichess_username)
    ).scalar_one_or_none()

    if existing:
        return {"status": "active", "user_id": existing.id}

    in_whitelist = db.session.execute(
        db.select(WhitelistEntry).filter_by(lichess_username=lichess_username)
    ).scalar_one_or_none() is not None

    max_users = _get_max_users()
    active_count = db.session.scalar(sa.select(sa.func.count()).select_from(User)) or 0

    if in_whitelist or max_users == 0 or active_count < max_users:
        return {
            "status": "onboarding",
            "lichess_username": lichess_username,
            "avatar_url": avatar_url,
        }

    _upsert_waitlist(lichess_username)
    return {"status": "waitlisted", "lichess_username": lichess_username}


def _upsert_waitlist(lichess_username: str) -> None:
    existing = db.session.execute(
        db.select(WaitlistEntry).filter_by(lichess_username=lichess_username)
    ).scalar_one_or_none()

    if not existing:
        entry = WaitlistEntry(
            lichess_username=lichess_username,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.session.add(entry)
        db.session.commit()


def create_user_from_onboarding(lichess_username: str, display_name: str, avatar_url: str | None) -> User:
    user = User(
        lichess_username=lichess_username,
        display_name=display_name,
        avatar_url=avatar_url,
        created_at=datetime.now(timezone.utc),
    )
    db.session.add(user)
    db.session.commit()
    return user


def update_waitlist_email(lichess_username: str, email: str) -> WaitlistEntry:
    entry = db.session.execute(
        db.select(WaitlistEntry).filter_by(lichess_username=lichess_username)
    ).scalar_one_or_none()

    if not entry:
        raise LookupError("Waitlist entry not found.")

    entry.email = email
    entry.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return entry


def get_waitlist_email(lichess_username: str) -> str | None:
    entry = db.session.execute(
        db.select(WaitlistEntry).filter_by(lichess_username=lichess_username)
    ).scalar_one_or_none()
    return entry.email if entry else None
