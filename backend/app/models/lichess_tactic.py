from sqlalchemy import Column, ForeignKey, Index, Integer, Text, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import Base
from app.models.lichess_tactic_theme import LichessTacticTheme
from app.models.opening import Opening
from app.models.training_item import TrainingItem


lichess_tactic_theme_links = Table(
    "lichess_tactic_theme_links",
    Base.metadata,
    Column("lichess_tactic_id", Integer, ForeignKey("lichess_tactics.id"), primary_key=True),
    Column("lichess_tactic_theme_id", Integer, ForeignKey("lichess_tactic_themes.id"), primary_key=True),
)

lichess_tactic_openings = Table(
    "lichess_tactic_openings",
    Base.metadata,
    Column("lichess_tactic_id", Integer, ForeignKey("lichess_tactics.id"), primary_key=True),
    Column("opening_id", Integer, ForeignKey("openings.id"), primary_key=True),
)


class LichessTactic(Base):
    __tablename__ = "lichess_tactics"

    id: Mapped[int] = mapped_column(primary_key=True)
    training_item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("training_items.id"), unique=True, nullable=False
    )
    puzzle_id: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    fen: Mapped[str] = mapped_column(Text, nullable=False)
    moves: Mapped[str] = mapped_column(Text, nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    rating_deviation: Mapped[int] = mapped_column(Integer, nullable=False)
    popularity: Mapped[int] = mapped_column(Integer, nullable=False)
    nb_plays: Mapped[int] = mapped_column(Integer, nullable=False)
    game_url: Mapped[str] = mapped_column(Text, nullable=False)

    training_item: Mapped[TrainingItem] = relationship(
        "TrainingItem", back_populates="lichess_tactic"
    )
    themes: Mapped[list[LichessTacticTheme]] = relationship(
        "LichessTacticTheme", secondary=lichess_tactic_theme_links, lazy="select"
    )
    openings: Mapped[list[Opening]] = relationship(
        "Opening", secondary=lichess_tactic_openings, lazy="select"
    )

    __table_args__ = (
        Index("ix_lichess_tactics_rating", "rating"),
        Index("ix_lichess_tactics_popularity", "popularity"),
    )
