from flask import Flask, Response, jsonify
from werkzeug.exceptions import HTTPException

from app.exceptions import ConflictError, ValidationError


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(ValidationError)
    def handle_validation(e: ValidationError) -> tuple[Response, int]:
        return jsonify({"error": str(e)}), 422

    @app.errorhandler(ConflictError)
    def handle_conflict(e: ConflictError) -> tuple[Response, int]:
        return jsonify({"error": str(e)}), 409

    @app.errorhandler(LookupError)
    def handle_lookup(e: LookupError) -> tuple[Response, int]:
        return jsonify({"error": str(e)}), 404

    @app.errorhandler(PermissionError)
    def handle_permission(e: PermissionError) -> tuple[Response, int]:
        return jsonify({"error": str(e)}), 403

    @app.errorhandler(Exception)
    def handle_exception(e: Exception) -> tuple[Response, int]:
        if isinstance(e, HTTPException):
            return jsonify({"error": e.description}), e.code or 500
        app.logger.error("Unhandled exception", exc_info=e)
        return jsonify({"error": "Something went wrong"}), 500

    @app.errorhandler(404)
    def handle_not_found(e: Exception) -> tuple[Response, int]:
        return jsonify({"error": "Not found"}), 404
