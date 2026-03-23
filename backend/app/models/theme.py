from sqlalchemy import Text, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.extensions import db


class Theme(db.Model):
    __tablename__ = "themes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    display_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (Index("ix_themes_name", "name"),)
