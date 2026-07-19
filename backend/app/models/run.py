from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.extensions import Base


class Run(Base):
    __tablename__ = "runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    training_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("trainings.id"), nullable=False
    )
    run_index: Mapped[int] = mapped_column(Integer, nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    aborted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    target_accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    target_min_solve_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_max_solve_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    @property
    def status(self) -> str:
        if self.aborted_at is not None:
            return "aborted"
        if self.completed_at is not None:
            return "completed"
        return "active"

    training_items: Mapped[list["RunTrainingItem"]] = relationship(
        "RunTrainingItem", order_by="RunTrainingItem.position", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_runs_training_id", "training_id"),
    )


class RunTrainingItem(Base):
    __tablename__ = "run_training_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(Integer, ForeignKey("runs.id"), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    training_item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("training_items.id"), nullable=False
    )

    attempts: Mapped[list["TrainingAttempt"]] = relationship(
        "TrainingAttempt", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("run_id", "position", name="uq_run_training_item_position"),
    )


class TrainingAttempt(Base):
    __tablename__ = "training_attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    run_training_item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("run_training_items.id"), nullable=False
    )
    try_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(15), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    time_spent_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    moves: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    __table_args__ = (
        UniqueConstraint(
            "run_training_item_id", "try_number", name="uq_attempt_run_training_item_try"
        ),
        Index("ix_training_attempts_run_training_item_id", "run_training_item_id"),
    )
