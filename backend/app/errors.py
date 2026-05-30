from flask import Flask, Response, jsonify
from werkzeug.exceptions import HTTPException

from app.exceptions import AppError


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(AppError)
    def handle_app_error(e: AppError) -> tuple[Response, int]:
        return jsonify({"title": e.title, "detail": e.detail}), e.status_code

    @app.errorhandler(Exception)
    def handle_exception(e: Exception) -> tuple[Response, int]:
        if isinstance(e, HTTPException):
            return jsonify({
                "title": "Request error",
                "detail": e.description or "The request could not be processed.",
            }), e.code or 500
        app.logger.error("Unhandled exception", exc_info=e)
        return jsonify({
            "title": "Something went wrong",
            "detail": "An unexpected error occurred. Please try again.",
        }), 500

    @app.errorhandler(404)
    def handle_not_found(e: Exception) -> tuple[Response, int]:
        return jsonify({
            "title": "Not found",
            "detail": "The requested resource does not exist.",
        }), 404
