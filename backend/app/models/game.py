from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import Base
from app.models.opening import Opening

if TYPE_CHECKING:
    from app.models.source_import_run import SourceImportRun


class Game(Base):
    __tablename__ = "games"

    id: Mapped[int] = mapped_column(primary_key=True)
    lichess_id: Mapped[str | None] = mapped_column(Text, unique=True, nullable=True)
    white: Mapped[str] = mapped_column(Text, nullable=False)
    black: Mapped[str] = mapped_column(Text, nullable=False)
    white_elo: Mapped[int | None] = mapped_column(Integer, nullable=True)
    black_elo: Mapped[int | None] = mapped_column(Integer, nullable=True)
    white_title: Mapped[str | None] = mapped_column(Text, nullable=True)
    black_title: Mapped[str | None] = mapped_column(Text, nullable=True)
    event: Mapped[str | None] = mapped_column(Text, nullable=True)
    date: Mapped[str | None] = mapped_column(Text, nullable=True)
    eco: Mapped[str | None] = mapped_column(Text, nullable=True)
    opening_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("openings.id"), nullable=True)
    source_import_run_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("source_import_runs.id"), nullable=False
    )

    opening: Mapped[Opening | None] = relationship("Opening")
    source_import_run: Mapped["SourceImportRun"] = relationship("SourceImportRun")

    __table_args__ = (
        Index("ix_games_lichess_id", "lichess_id"),
        Index("ix_games_opening_id", "opening_id"),
        Index("ix_games_source_import_run_id", "source_import_run_id"),
    )
