import os
import re

from flask import Blueprint, redirect, session, request, jsonify, Response
from werkzeug.wrappers import Response as WerkzeugResponse
from app.extensions import db
from app.models.user import User
from app.services.auth_service import (
    build_lichess_auth_url,
    exchange_code_for_token,
    generate_pkce_pair,
    get_or_create_user,
    create_user_from_onboarding,
    update_waitlist_email,
    get_waitlist_email,
)
from app.services.validation import validate_display_name

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")

APP_ORIGIN = os.environ.get("APP_ORIGIN", "http://localhost:5173")
LICHESS_REDIRECT_URI = os.environ.get(
    "LICHESS_REDIRECT_URI", "http://localhost:5173/api/auth/callback"
)

_EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


@auth_bp.get("/login")
def login() -> WerkzeugResponse:
    verifier, challenge = generate_pkce_pair()
    session["code_verifier"] = verifier
    return redirect(build_lichess_auth_url(challenge, LICHESS_REDIRECT_URI))


@auth_bp.get("/callback")
def callback() -> WerkzeugResponse:
    code = request.args.get("code")
    verifier = session.pop("code_verifier", None)

    if not code or not verifier:
        return redirect(f"{APP_ORIGIN}?error=auth_failed")

    access_token = exchange_code_for_token(code, verifier, LICHESS_REDIRECT_URI)
    if not access_token:
        return redirect(f"{APP_ORIGIN}?error=token_failed")

    try:
        result = get_or_create_user(access_token)
    except Exception:
        return redirect(f"{APP_ORIGIN}?error=user_fetch_failed")

    status = result["status"]
    if status == "active":
        session["user_id"] = result["user_id"]
    elif status == "onboarding":
        session["pending_onboarding"] = {
            "lichess_username": result["lichess_username"],
            "avatar_url": result["avatar_url"],
        }
    elif status == "waitlisted":
        session["waitlisted_lichess_username"] = result["lichess_username"]

    return redirect(APP_ORIGIN)


@auth_bp.post("/logout")
def logout() -> tuple[str, int]:
    session.clear()
    return "", 204


@auth_bp.get("/me")
def me() -> tuple[Response, int] | Response:
    user_id = session.get("user_id")
    if user_id:
        user = db.session.get(User, user_id)
        if not user:
            session.clear()
            return jsonify({"error": "not authenticated"}), 401
        return jsonify({
            "status": "active",
            "id": user.id,
            "username": user.lichess_username,
            "displayName": user.display_name,
            "avatarUrl": user.avatar_url,
            "boardTheme": user.board_theme,
            "pieceTheme": user.piece_theme,
            "showTimerTenths": user.show_timer_tenths,
        })

    pending = session.get("pending_onboarding")
    if pending:
        return jsonify({
            "status": "onboarding",
            "lichessUsername": pending["lichess_username"],
            "avatarUrl": pending.get("avatar_url"),
        })

    waitlisted = session.get("waitlisted_lichess_username")
    if waitlisted:
        email = get_waitlist_email(waitlisted)
        return jsonify({"status": "waitlisted", "email": email})

    return jsonify({"error": "not authenticated"}), 401


@auth_bp.post("/onboarding")
def onboarding() -> tuple[Response, int] | Response:
    pending = session.get("pending_onboarding")
    if not pending:
        return jsonify({"error": "no pending onboarding session"}), 401

    data: dict[str, object] = request.get_json(silent=True) or {}
    raw_display_name = data.get("displayName")
    if not isinstance(raw_display_name, str):
        return jsonify({"error": "displayName is required"}), 400

    try:
        display_name = validate_display_name(raw_display_name)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    lichess_username: str = pending["lichess_username"]
    avatar_url: str | None = pending.get("avatar_url")

    user = create_user_from_onboarding(lichess_username, display_name, avatar_url)

    session.pop("pending_onboarding", None)
    session["user_id"] = user.id

    return jsonify({
        "status": "active",
        "id": user.id,
        "username": user.lichess_username,
        "displayName": user.display_name,
        "avatarUrl": user.avatar_url,
        "boardTheme": user.board_theme,
        "pieceTheme": user.piece_theme,
        "showTimerTenths": user.show_timer_tenths,
    })


@auth_bp.patch("/waitlist/email")
def update_email() -> tuple[Response, int] | Response:
    waitlisted = session.get("waitlisted_lichess_username")
    if not waitlisted:
        return jsonify({"error": "not on waitlist"}), 401

    data: dict[str, object] = request.get_json(silent=True) or {}
    email = data.get("email")
    if not isinstance(email, str) or not _EMAIL_RE.match(email):
        return jsonify({"error": "invalid email address"}), 400

    try:
        entry = update_waitlist_email(waitlisted, email)
    except LookupError as e:
        return jsonify({"error": str(e)}), 404

    return jsonify({"status": "waitlisted", "email": entry.email})
