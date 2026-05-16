#!/usr/bin/env python3
"""Generate a signed Flask session cookie for a given Lichess username.

Intended for Playwright / AI-assisted UI inspection in development only.
Run via: make -C backend dev-session USERNAME=<lichess_username>

Outputs the session cookie value to stdout so the caller can inject it
into a browser (e.g. via document.cookie). Nothing is sent over HTTP.
"""
import os
import sys

import psycopg2  # type: ignore[import-untyped]
from flask import Flask
from flask.sessions import SecureCookieSessionInterface


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: dev_session.py <lichess_username>", file=sys.stderr)
        sys.exit(1)

    username = sys.argv[1].strip().lower()

    secret_key = os.environ.get("SECRET_KEY")
    database_url = os.environ.get("DATABASE_URL")

    if not secret_key:
        print("error: SECRET_KEY is not set", file=sys.stderr)
        sys.exit(1)
    if not database_url:
        print("error: DATABASE_URL is not set", file=sys.stderr)
        sys.exit(1)

    conn = psycopg2.connect(database_url)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE lichess_username = %s", (username,))
            row = cur.fetchone()
    finally:
        conn.close()

    if row is None:
        print(f"error: no user found with lichess_username '{username}'", file=sys.stderr)
        sys.exit(1)

    user_id: int = row[0]

    app = Flask(__name__)
    app.config["SECRET_KEY"] = secret_key
    signing_serializer = SecureCookieSessionInterface().get_signing_serializer(app)
    assert signing_serializer is not None
    cookie_value: str = signing_serializer.dumps({"user_id": user_id})

    print(cookie_value)


if __name__ == "__main__":
    main()
