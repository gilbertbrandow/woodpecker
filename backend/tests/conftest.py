import os
import pytest
from flask import Flask
from flask.testing import FlaskClient


@pytest.fixture(scope="session")
def app() -> Flask:
    os.environ.setdefault("SECRET_KEY", "test-secret-key")
    os.environ.setdefault(
        "DATABASE_URL",
        "postgresql://woodpecker:woodpecker@localhost:5432/woodpecker_test",
    )
    from app import create_app

    flask_app = create_app()
    flask_app.config["TESTING"] = True
    return flask_app


@pytest.fixture()
def client(app: Flask) -> FlaskClient:
    return app.test_client()
