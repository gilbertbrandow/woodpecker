from functools import wraps
from typing import Callable
from flask import session, jsonify


def login_required(f: Callable) -> Callable:
    @wraps(f)
    def decorated(*args: object, **kwargs: object) -> object:
        if not session.get("user_id"):
            return jsonify({"error": "not authenticated"}), 401
        return f(*args, **kwargs)
    return decorated
