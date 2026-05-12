import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session as SASession

_factory: sessionmaker[SASession] | None = None


def _get_factory() -> sessionmaker[SASession]:
    global _factory
    if _factory is None:
        url = os.environ.get("DATABASE_URL")
        if not url:
            raise SystemExit("ERROR: DATABASE_URL environment variable is not set.")
        _factory = sessionmaker(bind=create_engine(url))
    return _factory


def Session() -> SASession:
    return _get_factory()()
