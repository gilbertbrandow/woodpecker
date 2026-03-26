from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.extensions import Base


class Subset(Base):
    __tablename__ = "subsets"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="draft")
    puzzle_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    config: Mapped[dict[str, object] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    locked_puzzle_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    puzzles: Mapped[list["SubsetPuzzle"]] = relationship(
        "SubsetPuzzle", order_by="SubsetPuzzle.position", cascade="all, delete-orphan"
    )


class SubsetPuzzle(Base):
    __tablename__ = "subset_puzzles"

    subset_id: Mapped[int] = mapped_column(Integer, ForeignKey("subsets.id"), primary_key=True)
    puzzle_id: Mapped[int] = mapped_column(Integer, ForeignKey("puzzles.id"), primary_key=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    is_discarded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
