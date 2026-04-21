from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.extensions import Base

MAX_PUZZLE_TIME_MS: int = 600_000


class Run(Base):
    __tablename__ = "runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    participation_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("schedule_participations.id"), nullable=False
    )
    run_index: Mapped[int] = mapped_column(Integer, nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    aborted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    @property
    def status(self) -> str:
        if self.aborted_at is not None:
            return "aborted"
        if self.completed_at is not None:
            return "completed"
        return "active"

    puzzles: Mapped[list["RunPuzzle"]] = relationship(
        "RunPuzzle", order_by="RunPuzzle.position", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_runs_participation_id", "participation_id"),
    )


class RunPuzzle(Base):
    __tablename__ = "run_puzzles"

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(Integer, ForeignKey("runs.id"), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    puzzle_id: Mapped[int] = mapped_column(Integer, ForeignKey("puzzles.id"), nullable=False)

    attempts: Mapped[list["PuzzleAttempt"]] = relationship(
        "PuzzleAttempt", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("run_id", "position", name="uq_run_puzzle_position"),
    )


class PuzzleAttempt(Base):
    __tablename__ = "puzzle_attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    run_puzzle_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("run_puzzles.id"), nullable=False
    )
    try_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(15), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    time_spent_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    moves: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    __table_args__ = (
        UniqueConstraint("run_puzzle_id", "try_number", name="uq_attempt_run_puzzle_try"),
        Index("ix_puzzle_attempts_run_puzzle_id", "run_puzzle_id"),
    )
