"""seed openings

Revision ID: f4a5b6c7d8e9
Revises: e3f4a5b6c7d8
Create Date: 2026-03-23

"""
revision: str = "f4a5b6c7d8e9"
down_revision: str | None = "e3f4a5b6c7d8"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    # Data seeding removed — run `make -C pipeline shared-openings-import` instead.
    pass


def downgrade() -> None:
    pass
