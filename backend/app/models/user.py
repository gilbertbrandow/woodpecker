from datetime import datetime, timezone
import sqlalchemy as sa
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from app.extensions import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    lichess_username: Mapped[str] = mapped_column(unique=True)
    display_name: Mapped[str] = mapped_column(String(32), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True, default=None)
    board_theme: Mapped[str] = mapped_column(String(64), nullable=False, default="green", server_default="green")
    piece_theme: Mapped[str] = mapped_column(String(64), nullable=False, default="cburnett", server_default="cburnett")
    show_timer_tenths: Mapped[bool] = mapped_column(nullable=False, default=True, server_default=sa.true())
    sound_enabled: Mapped[bool] = mapped_column(nullable=False, default=False, server_default=sa.false())
    sound_theme: Mapped[str] = mapped_column(String(32), nullable=False, default="standard", server_default="standard")
    opponent_move_delay_ms: Mapped[int] = mapped_column(nullable=False, default=300, server_default="300")
    animation_duration_ms: Mapped[int] = mapped_column(nullable=False, default=150, server_default="150")
    is_superadmin: Mapped[bool] = mapped_column(nullable=False, default=False, server_default=sa.false())
    last_login_at: Mapped[datetime | None] = mapped_column(nullable=True, default=None)
    last_seen_at: Mapped[datetime | None] = mapped_column(nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc)
    )


class WaitlistEntry(Base):
    __tablename__ = "waitlist"

    id: Mapped[int] = mapped_column(primary_key=True)
    lichess_username: Mapped[str] = mapped_column(unique=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(254), nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class WhitelistEntry(Base):
    __tablename__ = "whitelist"

    id: Mapped[int] = mapped_column(primary_key=True)
    lichess_username: Mapped[str] = mapped_column(unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc)
    )
