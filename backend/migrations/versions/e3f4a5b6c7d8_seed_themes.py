"""seed themes

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-03-23

"""
revision: str = "e3f4a5b6c7d8"
down_revision: str | None = "d2e3f4a5b6c7"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    # Data seeding removed — run `make -C pipeline lichess-tactics-themes-import` instead.
    pass


def downgrade() -> None:
    pass
