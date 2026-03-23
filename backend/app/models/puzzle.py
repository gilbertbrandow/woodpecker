from sqlalchemy import Text, Integer, Index, Table, Column, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.extensions import db
from app.models.theme import Theme
from app.models.opening import Opening


puzzle_themes = Table(
    "puzzle_themes",
    db.metadata,
    Column("puzzle_id", Integer, ForeignKey("puzzles.id"), primary_key=True),
    Column("theme_id", Integer, ForeignKey("themes.id"), primary_key=True),
)

puzzle_openings = Table(
    "puzzle_openings",
    db.metadata,
    Column("puzzle_id", Integer, ForeignKey("puzzles.id"), primary_key=True),
    Column("opening_id", Integer, ForeignKey("openings.id"), primary_key=True),
)


class Puzzle(db.Model):
    __tablename__ = "puzzles"

    id: Mapped[int] = mapped_column(primary_key=True)
    puzzle_id: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    fen: Mapped[str] = mapped_column(Text, nullable=False)
    moves: Mapped[str] = mapped_column(Text, nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    rating_deviation: Mapped[int] = mapped_column(Integer, nullable=False)
    popularity: Mapped[int] = mapped_column(Integer, nullable=False)
    nb_plays: Mapped[int] = mapped_column(Integer, nullable=False)
    game_url: Mapped[str] = mapped_column(Text, nullable=False)

    themes: Mapped[list[Theme]] = relationship("Theme", secondary=puzzle_themes, lazy="select")
    openings: Mapped[list[Opening]] = relationship("Opening", secondary=puzzle_openings, lazy="select")

    __table_args__ = (
        Index("ix_puzzles_rating", "rating"),
        Index("ix_puzzles_popularity", "popularity"),
    )
