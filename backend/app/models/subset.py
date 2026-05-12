from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.extensions import Base


class Subset(Base):
    __tablename__ = "subsets"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    puzzle_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    config: Mapped[dict[str, object] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    locked_puzzle_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    training_items: Mapped[list["SubsetTrainingItem"]] = relationship(
        "SubsetTrainingItem", order_by="SubsetTrainingItem.position", cascade="all, delete-orphan"
    )


class SubsetTrainingItem(Base):
    __tablename__ = "subset_training_items"

    subset_id: Mapped[int] = mapped_column(Integer, ForeignKey("subsets.id"), primary_key=True)
    training_item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("training_items.id"), primary_key=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
