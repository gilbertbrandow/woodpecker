# Error envelope and exception hierarchy

supersedes: ADR-0013

The previous error contract returned `{"error": "string"}` with a 400/422 split whose sole purpose was to tell the frontend which errors were user-safe to display. We replaced it with a structured envelope `{"title": "...", "detail": "..."}` and a typed `AppError` exception hierarchy.

Both `title` and `detail` are required and non-null on every error response — no optional fields. Making `detail` optional would create inconsistent toast UI and let lazy error messages slip through; requiring both forces deliberate copy at every raise site. The HTTP status code is carried only in the response header, not repeated in the body.

The backend hierarchy is `AppError` (base) with four subclasses: `ValidationError` (422), `ConflictError` (409), `NotFoundError` (404), `ForbiddenError` (403). The class encodes the status code; the raise site supplies only `title` and `detail`. `BadRequestError` (400) was deliberately dropped — the 400/422 split existed only to distinguish "never show to user" (400) from "always show to user" (422). With all 4xx now displaying the backend's copy verbatim, the distinction has no practical effect.

Python builtins (`LookupError`, `PermissionError`) are replaced by `NotFoundError` and `ForbiddenError` so every raise site is typed, carries required copy, and is caught by a single `AppError` handler rather than separate handlers per builtin. The base class is named `AppError` rather than `HttpException` to avoid collision with Werkzeug's own `HTTPException` which is in scope in `errors.py`.

A `meta` field for structured Sentry context was considered and deferred — the envelope shape reserves space for it as a future extension.
