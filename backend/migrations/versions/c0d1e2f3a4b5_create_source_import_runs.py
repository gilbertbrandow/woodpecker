"""create source_import_runs

Revision ID: c0d1e2f3a4b5
Revises: b2c3d4e5f6a7
Branch Labels: None
Depends On: None

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "c0d1e2f3a4b5"
down_revision: str | None = "b2c3d4e5f6a7"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    source_import_source = postgresql.ENUM("LICHESS_TACTICS", name="source_import_source")
    source_import_source.create(op.get_bind(), checkfirst=True)

    source_import_operation = postgresql.ENUM("LICHESS_TACTICS_IMPORT", name="source_import_operation")
    source_import_operation.create(op.get_bind(), checkfirst=True)

    source_import_status = postgresql.ENUM("RUNNING", "SUCCEEDED", "FAILED", name="source_import_status")
    source_import_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "source_import_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "source",
            postgresql.ENUM("LICHESS_TACTICS", name="source_import_source", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "operation",
            postgresql.ENUM("LICHESS_TACTICS_IMPORT", name="source_import_operation", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM("RUNNING", "SUCCEEDED", "FAILED", name="source_import_status", create_type=False),
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("parameters_json", postgresql.JSONB(), nullable=True),
        sa.Column("summary_json", postgresql.JSONB(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("source_import_runs")
    op.execute(sa.text("DROP TYPE IF EXISTS source_import_status"))
    op.execute(sa.text("DROP TYPE IF EXISTS source_import_operation"))
    op.execute(sa.text("DROP TYPE IF EXISTS source_import_source"))
