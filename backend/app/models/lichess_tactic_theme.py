from sqlalchemy import Enum, Index, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import Base
from app.models.theme_category import ThemeCategory


class LichessTacticTheme(Base):
    __tablename__ = "lichess_tactic_themes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[ThemeCategory] = mapped_column(
        Enum(ThemeCategory, name="lichess_tactic_theme_category"), nullable=False
    )

    __table_args__ = (Index("ix_lichess_tactic_themes_name", "name"),)
