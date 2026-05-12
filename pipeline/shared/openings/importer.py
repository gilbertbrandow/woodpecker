from pathlib import Path

from sqlalchemy.orm import Session


def import_openings(session: Session, files: list[Path]) -> None:
    raise NotImplementedError
