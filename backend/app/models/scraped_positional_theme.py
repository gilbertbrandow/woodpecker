from sqlalchemy import Index, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import Base


class ScrapedPositionalTheme(Base):
    __tablename__ = "scraped_positional_themes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (Index("ix_scraped_positional_themes_name", "name"),)
