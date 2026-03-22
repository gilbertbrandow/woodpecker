import os
import hashlib
import base64
import urllib.parse

import berserk
import requests as http

from app.extensions import db
from app.models.user import User

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
        "scope": "preference:read",
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
    return response.json().get("access_token")


def get_or_create_user(access_token: str) -> User:
    lichess_session = berserk.TokenSession(access_token)
    client = berserk.Client(session=lichess_session)
    account = client.account.get()
    username: str = account["username"]

    user = db.session.execute(
        db.select(User).filter_by(lichess_username=username)
    ).scalar_one_or_none()

    if not user:
        user = User(lichess_username=username)
        db.session.add(user)
        db.session.commit()

    return user
