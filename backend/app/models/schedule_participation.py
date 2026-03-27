from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.extensions import Base


class ScheduleParticipation(Base):
    __tablename__ = "schedule_participations"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    schedule_id: Mapped[int] = mapped_column(Integer, ForeignKey("schedules.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(15), nullable=False, default="draft")
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    aborted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    run_targets: Mapped[list["ParticipationRunTarget"]] = relationship(
        "ParticipationRunTarget", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("user_id", "schedule_id", name="uq_participation_user_schedule"),
    )


class ParticipationRunTarget(Base):
    __tablename__ = "participation_run_targets"

    participation_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("schedule_participations.id"), primary_key=True
    )
    run_index: Mapped[int] = mapped_column(Integer, primary_key=True)
    target_accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    target_solve_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
