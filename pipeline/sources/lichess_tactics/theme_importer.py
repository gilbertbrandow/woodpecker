from pathlib import Path

from sqlalchemy.orm import Session


def import_themes(session: Session, file: Path) -> None:
    raise NotImplementedError
