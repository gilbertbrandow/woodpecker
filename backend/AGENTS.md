# Backend Agent Guide

## Exception hierarchy

All user-facing errors must be raised as `AppError` subclasses from `app/exceptions.py`. Never use raw Python builtins for errors that map to HTTP responses.

| Class | HTTP | When to raise |
| ------- | ------ | --------------- |
| `ValidationError` | 422 | User-supplied input fails semantic validation |
| `NotFoundError` | 404 | A resource the user requested does not exist |
| `ConflictError` | 409 | The action conflicts with current resource state |
| `ForbiddenError` | 403 | The authenticated user lacks permission |

Both `title` and `detail` are required — no optional fields. `title` is the short label shown in the toast; `detail` is the user-facing sentence explaining what went wrong. Both are shown verbatim in the frontend.

```python
# Good
raise ValidationError("Name required", "Please provide a name for the subset.")
raise NotFoundError("Subset not found", "The requested subset does not exist.")
raise ConflictError("Already enrolled", "You are already enrolled in this schedule.")
raise ForbiddenError("Access denied", "You do not have permission to perform this action.")

# Wrong — do not use raw builtins for user-facing errors
raise ValueError("Name required")
raise LookupError("Not found")
```

The error handler in `app/errors.py` catches `AppError` and serialises it to `{"title": ..., "detail": ...}` with the correct status code. The 500 handler also uses this envelope shape so the frontend can always parse errors consistently.

## Error handler — do not modify without care

`app/errors.py` registers three handlers:

- `AppError` → `{"title": e.title, "detail": e.detail}` + `e.status_code`
- `HTTPException` (Werkzeug) → structured envelope + `e.code`
- Unhandled `Exception` → generic 500 envelope + logs via `app.logger.error`

Do not add `sentry_sdk.capture_exception()` calls anywhere in route handlers or services — `FlaskIntegration` captures unhandled exceptions automatically, and `AppError` subclasses are in `ignore_errors` so they are silently ignored by Sentry (they are expected domain errors, not bugs).

## Sentry

- **Captures:** unhandled exceptions (5xx) only — bugs, not domain errors
- **Ignores:** all `AppError` subclasses via `ignore_errors=[AppError]` in `sentry_sdk.init()`
- **User context:** set in a `before_request` hook via `sentry_sdk.set_user({"id": str(user_id)})`
- **Environment:** `FLASK_ENV` env var, defaults to `"production"`
- **DSN:** `SENTRY_DSN` env var — Sentry is fully disabled when unset (local dev default)

## Services own errors, routes own HTTP

Business logic and all raises live in `backend/app/services/`. Route handlers only parse the request, call a service, and return JSON. A route handler that raises an `AppError` directly is a code smell.
