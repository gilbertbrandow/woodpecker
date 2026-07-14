import sqlalchemy as sa

from app.extensions import db
from app.models.user import User
from app.selectable import UserSelectorOut


def _to_selectable(u: User) -> UserSelectorOut:
    return {"id": u.id, "displayName": u.display_name, "avatarUrl": u.avatar_url}


def get_users_by_ids(ids: list[int]) -> list[UserSelectorOut]:
    if not ids:
        return []
    rows = db.session.scalars(sa.select(User).where(User.id.in_(ids))).all()
    return [_to_selectable(u) for u in rows]


def suggest_users(exclude_id: int | None = None, limit: int = 5) -> list[UserSelectorOut]:
    stmt = sa.select(User).order_by(User.last_seen_at.desc().nulls_last()).limit(limit)
    if exclude_id is not None:
        stmt = stmt.where(User.id != exclude_id)
    rows = db.session.scalars(stmt).all()
    return [_to_selectable(u) for u in rows]


def search_users(q: str, limit: int = 10) -> list[UserSelectorOut]:
    pattern = f"%{q}%"
    rows = db.session.scalars(
        sa.select(User)
        .where(User.display_name.ilike(pattern))
        .order_by(User.display_name)
        .limit(limit)
    ).all()
    return [_to_selectable(u) for u in rows]
