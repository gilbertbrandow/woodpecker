import enum
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import Base

if TYPE_CHECKING:
    from app.models.lichess_tactic import LichessTactic
    from app.models.scraped_positional_puzzle import ScrapedPositionalPuzzle
    from app.models.source_import_run import SourceImportRun


class TrainingItemSource(enum.Enum):
    LICHESS_TACTIC = "LICHESS_TACTIC"
    DECOY = "DECOY"
    SCRAPED_POSITIONAL = "SCRAPED_POSITIONAL"


class TrainingItem(Base):
    __tablename__ = "training_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_type: Mapped[TrainingItemSource] = mapped_column(
        Enum(TrainingItemSource, name="training_item_source"), nullable=False
    )
    source_import_run_id: Mapped[int | None] = mapped_column(
        ForeignKey("source_import_runs.id"), nullable=True
    )

    lichess_tactic: Mapped["LichessTactic"] = relationship(
        "LichessTactic", back_populates="training_item", uselist=False
    )
    positional_puzzle: Mapped["ScrapedPositionalPuzzle"] = relationship(
        "ScrapedPositionalPuzzle", back_populates="training_item", uselist=False
    )
    source_import_run: Mapped["SourceImportRun | None"] = relationship(
        "SourceImportRun", back_populates="training_items"
    )
