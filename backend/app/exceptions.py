class AppError(Exception):
    """Base for all domain errors that map to HTTP error responses."""

    status_code: int

    def __init_subclass__(cls, **kwargs: object) -> None:
        super().__init_subclass__(**kwargs)
        if "status_code" not in cls.__dict__:
            raise TypeError(f"{cls.__name__} must define status_code")

    def __init__(self, title: str, detail: str) -> None:
        super().__init__(f"{title}: {detail}")
        self.title = title
        self.detail = detail


class ValidationError(AppError):
    """Raised when user-supplied input fails semantic validation (HTTP 422)."""

    status_code = 422


class ConflictError(AppError):
    """Raised when a request conflicts with current resource state (HTTP 409)."""

    status_code = 409


class NotFoundError(AppError):
    """Raised when a requested resource does not exist (HTTP 404)."""

    status_code = 404


class ForbiddenError(AppError):
    """Raised when the authenticated user lacks permission (HTTP 403)."""

    status_code = 403
