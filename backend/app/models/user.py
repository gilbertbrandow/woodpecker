from datetime import datetime, timezone
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from app.extensions import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    lichess_username: Mapped[str] = mapped_column(unique=True)
    nickname: Mapped[str | None] = mapped_column(String(32), nullable=True, default=None)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True, default=None)
    board_theme: Mapped[str] = mapped_column(String(64), nullable=False, default="green", server_default="green")
    piece_theme: Mapped[str] = mapped_column(String(64), nullable=False, default="cburnett", server_default="cburnett")
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc)
    )
