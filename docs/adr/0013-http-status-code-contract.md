# HTTP status code contract

The backend uses a strict mapping between failure category and HTTP status code. `400` means the request was structurally malformed — a frontend bug; the message is never shown to the user. `422` means the request was well-formed but semantically invalid due to user input (validation failures); the backend message is shown verbatim. `409` means a state conflict caused by the user; the backend message is shown verbatim. `401` means not authenticated; the frontend redirects to the login page globally. `403` means authenticated but not permitted; treated as a frontend guard failure and surfaced generically. `404` means the resource does not exist from the user's perspective; handling is caller-local. `500` means an unhandled exception; the user sees a generic fallback only.

The 400/422 split was a deliberate choice over collapsing both into `400`. The distinction lets the frontend apply a clear rule: show the backend message for `422` and `409`, never for `400`. Without the split, every call site would need its own judgement about whether the `400` message is user-safe.

superseded by: ADR-0016

The exception-to-code convention has since moved to a typed `AppError` hierarchy (`ValidationError`, `NotFoundError`, `ConflictError`, `ForbiddenError`) defined in `backend/app/exceptions.py`. Raw Python builtins (`ValueError`, `LookupError`, `PermissionError`) and `BadRequestError` (400) are no longer used. See ADR-0016 for the current contract.
