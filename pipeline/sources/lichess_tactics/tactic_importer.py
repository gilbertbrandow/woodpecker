from pathlib import Path

from sqlalchemy.orm import Session


def import_tactics(session: Session, file: Path, limit: int | None = None, min_rating: int | None = None, max_rating: int | None = None, batch_size: int = 1000) -> None:
    raise NotImplementedError
