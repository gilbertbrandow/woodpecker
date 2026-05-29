class ConflictError(Exception):
    """Raised when a request conflicts with current resource state (HTTP 409)."""


class ValidationError(Exception):
    """Raised when user-supplied input fails semantic validation (HTTP 422)."""
