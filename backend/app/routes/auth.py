import os
from flask import Blueprint, redirect, session, request, jsonify, Response
from app.extensions import db
from app.models.user import User
from app.services.auth_service import (
    build_lichess_auth_url,
    exchange_code_for_token,
    generate_pkce_pair,
    get_or_create_user,
)

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")

APP_ORIGIN = os.environ.get("APP_ORIGIN", "http://localhost:5173")
LICHESS_REDIRECT_URI = os.environ.get(
    "LICHESS_REDIRECT_URI", "http://localhost:5173/api/auth/callback"
)


@auth_bp.get("/login")
def login() -> Response:
    verifier, challenge = generate_pkce_pair()
    session["code_verifier"] = verifier
    return redirect(build_lichess_auth_url(challenge, LICHESS_REDIRECT_URI))


@auth_bp.get("/callback")
def callback() -> Response:
    code = request.args.get("code")
    verifier = session.pop("code_verifier", None)

    if not code or not verifier:
        return redirect(f"{APP_ORIGIN}?error=auth_failed")

    access_token = exchange_code_for_token(code, verifier, LICHESS_REDIRECT_URI)
    if not access_token:
        return redirect(f"{APP_ORIGIN}?error=token_failed")

    try:
        user = get_or_create_user(access_token)
    except Exception:
        return redirect(f"{APP_ORIGIN}?error=user_fetch_failed")

    session["user_id"] = user.id
    return redirect(APP_ORIGIN)


@auth_bp.post("/logout")
def logout() -> tuple[str, int]:
    session.clear()
    return "", 204


@auth_bp.get("/me")
def me() -> tuple[Response, int] | Response:
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "not authenticated"}), 401

    user = db.session.get(User, user_id)
    if not user:
        session.clear()
        return jsonify({"error": "not authenticated"}), 401

    return jsonify({"id": user.id, "username": user.lichess_username})
