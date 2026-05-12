import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.extensions import Base

if TYPE_CHECKING:
    from app.models.lichess_tactic import LichessTactic


class TrainingItemSource(enum.Enum):
    LICHESS_TACTIC = "LICHESS_TACTIC"
    DECOY = "DECOY"
    POSITIONAL = "POSITIONAL"


class TrainingItem(Base):
    __tablename__ = "training_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_type: Mapped[TrainingItemSource] = mapped_column(
        Enum(TrainingItemSource, name="training_item_source"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    lichess_tactic: Mapped["LichessTactic"] = relationship(
        "LichessTactic", back_populates="training_item", uselist=False
    )
