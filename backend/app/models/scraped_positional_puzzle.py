from typing import TYPE_CHECKING

from sqlalchemy import Column, ForeignKey, Index, Integer, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import Base
from app.models.opening import Opening
from app.models.scraped_positional_difficulty import ScrapedPositionalDifficulty
from app.models.scraped_positional_theme import ScrapedPositionalTheme

if TYPE_CHECKING:
    from app.models.training_item import TrainingItem

scraped_positional_theme_links = Table(
    "scraped_positional_theme_links",
    Base.metadata,
    Column("positional_puzzle_id", Integer, ForeignKey("scraped_positional_puzzles.id"), primary_key=True),
    Column("positional_theme_id", Integer, ForeignKey("scraped_positional_themes.id"), primary_key=True),
)


class ScrapedPositionalPuzzle(Base):
    __tablename__ = "scraped_positional_puzzles"

    id: Mapped[int] = mapped_column(primary_key=True)
    training_item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("training_items.id"), unique=True, nullable=False
    )
    internal_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    fen: Mapped[str] = mapped_column(Text, nullable=False)
    moves: Mapped[str] = mapped_column(Text, nullable=False)
    lichess_url: Mapped[str] = mapped_column(Text, nullable=False)
    difficulty_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("scraped_positional_difficulties.id"), nullable=False
    )
    opening_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("openings.id"), nullable=True
    )

    training_item: Mapped["TrainingItem"] = relationship(
        "TrainingItem", back_populates="positional_puzzle", uselist=False
    )
    difficulty: Mapped[ScrapedPositionalDifficulty] = relationship("ScrapedPositionalDifficulty")
    themes: Mapped[list[ScrapedPositionalTheme]] = relationship(
        "ScrapedPositionalTheme", secondary=scraped_positional_theme_links, lazy="select"
    )
    opening: Mapped[Opening | None] = relationship("Opening")

    __table_args__ = (
        Index("ix_scraped_positional_puzzles_difficulty_id", "difficulty_id"),
        Index("ix_scraped_positional_puzzles_opening_id", "opening_id"),
    )
