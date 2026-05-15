import os

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
    is_access_approved,
)
from app.services.validation import validate_display_name, validate_email
import app.auth_session as auth_session
from app.user_schema import user_to_dict

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")

APP_ORIGIN = os.environ.get("APP_ORIGIN", "http://localhost:5173")
LICHESS_REDIRECT_URI = os.environ.get(
    "LICHESS_REDIRECT_URI", "http://localhost:5173/api/auth/callback"
)


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
        user_id = result["user_id"]
        assert isinstance(user_id, int)
        auth_session.set_active(user_id)
    elif status == "onboarding":
        username = result["lichess_username"]
        avatar = result.get("avatar_url")
        assert isinstance(username, str)
        assert avatar is None or isinstance(avatar, str)
        auth_session.set_onboarding(username, avatar)
    elif status == "waitlisted":
        username = result["lichess_username"]
        assert isinstance(username, str)
        auth_session.set_waitlisted(username)
    return redirect(APP_ORIGIN)


@auth_bp.post("/logout")
def logout() -> tuple[str, int]:
    auth_session.clear()
    return "", 204


@auth_bp.get("/me")
def me() -> tuple[Response, int] | Response:
    state = auth_session.read()

    if state is None:
        return jsonify({"error": "not authenticated"}), 401

    if state["kind"] == "active":
        user = db.session.get(User, state["user_id"])
        if not user:
            auth_session.clear()
            return jsonify({"error": "not authenticated"}), 401
        return jsonify(user_to_dict(user))

    if state["kind"] == "onboarding":
        return jsonify({
            "status": "onboarding",
            "lichessUsername": state["lichess_username"],
            "avatarUrl": state["avatar_url"],
        })

    lichess_username = state["lichess_username"]
    if is_access_approved(lichess_username):
        auth_session.set_onboarding(lichess_username, None)
        return jsonify({
            "status": "onboarding",
            "lichessUsername": lichess_username,
            "avatarUrl": None,
        })
    email = get_waitlist_email(lichess_username)
    return jsonify({"status": "waitlisted", "email": email})


@auth_bp.post("/onboarding")
def onboarding() -> tuple[Response, int] | Response:
    state = auth_session.read()
    if state is None or state["kind"] != "onboarding":
        return jsonify({"error": "no pending onboarding session"}), 401

    data: dict[str, object] = request.get_json(silent=True) or {}
    raw_display_name = data.get("displayName")
    if not isinstance(raw_display_name, str):
        return jsonify({"error": "displayName is required"}), 400

    try:
        display_name = validate_display_name(raw_display_name)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    user = create_user_from_onboarding(
        state["lichess_username"], display_name, state["avatar_url"]
    )
    auth_session.set_active(user.id)

    return jsonify(user_to_dict(user))


@auth_bp.patch("/waitlist/email")
def update_email() -> tuple[Response, int] | Response:
    state = auth_session.read()
    if state is None or state["kind"] != "waitlisted":
        return jsonify({"error": "not on waitlist"}), 401

    data: dict[str, object] = request.get_json(silent=True) or {}
    raw_email = data.get("email")
    if not isinstance(raw_email, str):
        return jsonify({"error": "invalid email address"}), 400

    try:
        email = validate_email(raw_email)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    try:
        entry = update_waitlist_email(state["lichess_username"], email)
    except LookupError as e:
        return jsonify({"error": str(e)}), 404

    return jsonify({"status": "waitlisted", "email": entry.email})
