from sqlalchemy import Text, Integer, Index, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column
from app.extensions import db


class Opening(db.Model):
    __tablename__ = "openings"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    display_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    eco: Mapped[str | None] = mapped_column(String(3), nullable=True)
    pgn: Mapped[str | None] = mapped_column(Text, nullable=True)
    parent_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("openings.id"), nullable=True)

    __table_args__ = (Index("ix_openings_name", "name"),)
