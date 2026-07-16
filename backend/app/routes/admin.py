import os
from datetime import datetime, timezone

import requests as http
import sqlalchemy as sa
from flask import Blueprint, Response, jsonify, request

from app.decorators import admin_required
from app.exceptions import ConflictError, NotFoundError
from app.extensions import db
from app.models.user import User, WaitlistEntry, WhitelistEntry
from app.table_query import TableQuery

admin_bp = Blueprint("admin", __name__, url_prefix="/admin")


@admin_bp.get("/stats")
@admin_required
def get_stats() -> Response:
    try:
        max_users = int(os.environ.get("MAX_USERS", "0"))
    except ValueError:
        max_users = 0

    active_count = db.session.scalar(sa.select(sa.func.count()).select_from(User)) or 0
    waitlist_count = db.session.scalar(sa.select(sa.func.count()).select_from(WaitlistEntry)) or 0
    whitelist_count = db.session.scalar(sa.select(sa.func.count()).select_from(WhitelistEntry)) or 0

    return jsonify({
        "maxUsers": max_users,
        "activeUserCount": active_count,
        "waitlistCount": waitlist_count,
        "whitelistCount": whitelist_count,
    })


@admin_bp.get("/users")
@admin_required
def list_users() -> Response:
    tq = TableQuery(request)
    role = tq.str_filter("role")
    created_at = tq.date_filter("createdAt")
    last_login_at = tq.date_filter("lastLoginAt")
    last_seen_at = tq.date_filter("lastSeenAt")

    query = sa.select(User)
    if tq.q:
        query = query.where(User.lichess_username.ilike(f"%{tq.q.lower()}%"))

    if role.str_values:
        valid = set(role.str_values) & {'admin', 'default'}
        if valid:
            role_bools = [v == 'admin' for v in valid]
            if role.op == 'is_not':
                query = query.where(User.is_superadmin.not_in(role_bools))
            else:
                query = query.where(User.is_superadmin.in_(role_bools))

    query = created_at.apply_orm(query, User.created_at)
    query = last_login_at.apply_orm(query, User.last_login_at)
    query = last_seen_at.apply_orm(query, User.last_seen_at)

    total = db.session.scalar(
        sa.select(sa.func.count()).select_from(query.subquery())
    ) or 0

    users = db.session.scalars(
        query.order_by(User.created_at.desc())
        .offset((tq.page - 1) * tq.page_size)
        .limit(tq.page_size)
    ).all()

    return jsonify({
        "items": [
            {
                "id": u.id,
                "lichessUsername": u.lichess_username,
                "displayName": u.display_name,
                "createdAt": u.created_at.isoformat(),
                "avatarUrl": u.avatar_url,
                "lastLoginAt": u.last_login_at.isoformat() if u.last_login_at else None,
                "lastSeenAt": u.last_seen_at.isoformat() if u.last_seen_at else None,
                "isSuperAdmin": u.is_superadmin,
            }
            for u in users
        ],
        "total": total,
    })


@admin_bp.get("/waitlist")
@admin_required
def list_waitlist() -> Response:
    tq = TableQuery(request)
    status = tq.str_filter("status")
    created_at = tq.date_filter("createdAt")
    updated_at = tq.date_filter("updatedAt")

    query = sa.select(WaitlistEntry)
    if tq.q:
        query = query.where(WaitlistEntry.lichess_username.ilike(f"%{tq.q.lower()}%"))

    if status.str_values:
        selected = set(status.str_values) & {'whitelisted', 'pending'}
        if selected and selected != {'whitelisted', 'pending'}:
            in_whitelist = WaitlistEntry.lichess_username.in_(
                sa.select(WhitelistEntry.lichess_username)
            )
            want_whitelisted = 'whitelisted' in selected
            cond = in_whitelist if want_whitelisted else ~in_whitelist
            if status.op == 'is_not':
                cond = ~cond
            query = query.where(cond)

    query = created_at.apply_orm(query, WaitlistEntry.created_at)
    query = updated_at.apply_orm(query, WaitlistEntry.updated_at)

    total = db.session.scalar(
        sa.select(sa.func.count()).select_from(query.subquery())
    ) or 0

    entries = db.session.scalars(
        query.order_by(WaitlistEntry.created_at.desc())
        .offset((tq.page - 1) * tq.page_size)
        .limit(tq.page_size)
    ).all()

    whitelisted_usernames: set[str] = set(
        db.session.scalars(sa.select(WhitelistEntry.lichess_username)).all()
    )

    return jsonify({
        "items": [
            {
                "id": e.id,
                "lichessUsername": e.lichess_username,
                "email": e.email,
                "createdAt": e.created_at.isoformat(),
                "updatedAt": e.updated_at.isoformat(),
                "isWhitelisted": e.lichess_username in whitelisted_usernames,
            }
            for e in entries
        ],
        "total": total,
    })


@admin_bp.delete("/waitlist/<string:username>")
@admin_required
def delete_waitlist(username: str) -> tuple[str, int]:
    normalized = username.strip().lower()
    entry = db.session.execute(
        sa.select(WaitlistEntry).filter_by(lichess_username=normalized)
    ).scalar_one_or_none()
    if not entry:
        raise NotFoundError("Not found", f"'{normalized}' is not on the waitlist.")

    db.session.delete(entry)
    db.session.commit()
    return "", 204


@admin_bp.get("/whitelist")
@admin_required
def list_whitelist() -> Response:
    tq = TableQuery(request)
    status = tq.str_filter("status")
    created_at = tq.date_filter("createdAt")

    query = sa.select(WhitelistEntry)
    if tq.q:
        query = query.where(WhitelistEntry.lichess_username.ilike(f"%{tq.q.lower()}%"))

    if status.str_values:
        selected = set(status.str_values) & {'registered', 'pending'}
        if selected and selected != {'registered', 'pending'}:
            in_users = WhitelistEntry.lichess_username.in_(
                sa.select(User.lichess_username)
            )
            want_registered = 'registered' in selected
            cond = in_users if want_registered else ~in_users
            if status.op == 'is_not':
                cond = ~cond
            query = query.where(cond)

    query = created_at.apply_orm(query, WhitelistEntry.created_at)

    total = db.session.scalar(
        sa.select(sa.func.count()).select_from(query.subquery())
    ) or 0

    entries = db.session.scalars(
        query.order_by(WhitelistEntry.created_at.desc())
        .offset((tq.page - 1) * tq.page_size)
        .limit(tq.page_size)
    ).all()

    registered_usernames: set[str] = set(
        db.session.scalars(sa.select(User.lichess_username)).all()
    )

    return jsonify({
        "items": [
            {
                "id": e.id,
                "lichessUsername": e.lichess_username,
                "createdAt": e.created_at.isoformat(),
                "isRegistered": e.lichess_username in registered_usernames,
            }
            for e in entries
        ],
        "total": total,
    })


@admin_bp.post("/whitelist")
@admin_required
def add_whitelist() -> tuple[Response, int]:
    data: dict[str, object] = request.get_json(silent=True) or {}
    raw = data.get("lichessUsername")
    if not isinstance(raw, str) or not raw.strip():
        return jsonify({"error": "lichessUsername is required"}), 400

    normalized = raw.strip().lower()

    existing_user = db.session.execute(
        sa.select(User).filter_by(lichess_username=normalized)
    ).scalar_one_or_none()
    if existing_user:
        raise ConflictError("Already registered", f"'{normalized}' already has an account.")

    existing = db.session.execute(
        sa.select(WhitelistEntry).filter_by(lichess_username=normalized)
    ).scalar_one_or_none()
    if existing:
        raise ConflictError("Already whitelisted", f"'{normalized}' is already on the whitelist.")

    entry = WhitelistEntry(
        lichess_username=normalized,
        created_at=datetime.now(timezone.utc),
    )
    db.session.add(entry)
    db.session.commit()

    return jsonify({
        "id": entry.id,
        "lichessUsername": entry.lichess_username,
        "createdAt": entry.created_at.isoformat(),
    }), 201


@admin_bp.delete("/whitelist/<string:username>")
@admin_required
def delete_whitelist(username: str) -> tuple[str, int]:
    normalized = username.strip().lower()
    entry = db.session.execute(
        sa.select(WhitelistEntry).filter_by(lichess_username=normalized)
    ).scalar_one_or_none()
    if not entry:
        raise NotFoundError("Not found", f"'{normalized}' is not on the whitelist.")

    db.session.delete(entry)
    db.session.commit()
    return "", 204


@admin_bp.get("/lichess/player-search")
@admin_required
def lichess_player_search() -> tuple[Response, int] | Response:
    term = request.args.get("term", "").strip()
    if len(term) < 2:
        return jsonify({"result": []})

    try:
        resp = http.get(
            "https://lichess.org/api/player/autocomplete",
            params={"term": term, "object": "true"},
            timeout=5,
        )
        if not resp.ok:
            return jsonify({"result": []})
        data = resp.json()
        return jsonify({"result": data.get("result", [])})
    except http.exceptions.RequestException:
        return jsonify({"result": []})
