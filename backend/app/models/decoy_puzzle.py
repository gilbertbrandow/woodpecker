from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import Base

if TYPE_CHECKING:
    from app.models.game import Game
    from app.models.training_item import TrainingItem


class DecoyPuzzle(Base):
    __tablename__ = "decoy_puzzles"

    id: Mapped[int] = mapped_column(primary_key=True)
    training_item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("training_items.id"), unique=True, nullable=False
    )
    fen: Mapped[str] = mapped_column(Text, nullable=False)
    opponent_move: Mapped[str] = mapped_column(Text, nullable=False)
    accepted_moves: Mapped[list] = mapped_column(JSONB, nullable=False)
    best_cp: Mapped[int] = mapped_column(Integer, nullable=False)
    depth: Mapped[int] = mapped_column(Integer, nullable=False)
    move_number: Mapped[int] = mapped_column(Integer, nullable=False)
    game_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("games.id"), nullable=True)
    analysis_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    training_item: Mapped["TrainingItem"] = relationship(
        "TrainingItem", back_populates="decoy_puzzle", uselist=False
    )
    game: Mapped["Game | None"] = relationship("Game")

    __table_args__ = (
        Index("ix_decoy_puzzles_game_id", "game_id"),
    )
