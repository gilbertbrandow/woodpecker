from collections.abc import Callable
from functools import wraps

from flask import jsonify, session


def login_required(f: Callable) -> Callable:
    @wraps(f)
    def decorated(*args: object, **kwargs: object) -> object:
        if not session.get("user_id"):
            return jsonify({"error": "not authenticated"}), 401
        return f(*args, **kwargs)
    return decorated


def admin_required(f: Callable) -> Callable:
    @wraps(f)
    def decorated(*args: object, **kwargs: object) -> object:
        import sqlalchemy as sa

        from app.extensions import db
        from app.models.user import User
        user_id = session.get("user_id")
        if not user_id:
            return jsonify({"error": "not authenticated"}), 401
        user = db.session.scalar(sa.select(User).where(User.id == user_id))
        if not user or not user.is_superadmin:
            return jsonify({"error": "forbidden"}), 403
        return f(*args, **kwargs)
    return decorated
