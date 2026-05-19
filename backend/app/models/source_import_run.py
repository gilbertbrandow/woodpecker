import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import Base

if TYPE_CHECKING:
    from app.models.training_item import TrainingItem


class SourceImportSource(enum.Enum):
    LICHESS_TACTICS = "LICHESS_TACTICS"
    SCRAPED_POSITIONAL = "SCRAPED_POSITIONAL"


class SourceImportOperation(enum.Enum):
    LICHESS_TACTICS_IMPORT = "LICHESS_TACTICS_IMPORT"
    SCRAPED_POSITIONAL_IMPORT = "SCRAPED_POSITIONAL_IMPORT"


class SourceImportStatus(enum.Enum):
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"


class SourceImportRun(Base):
    __tablename__ = "source_import_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[SourceImportSource] = mapped_column(
        Enum(SourceImportSource, name="source_import_source"), nullable=False
    )
    operation: Mapped[SourceImportOperation] = mapped_column(
        Enum(SourceImportOperation, name="source_import_operation"), nullable=False
    )
    status: Mapped[SourceImportStatus] = mapped_column(
        Enum(SourceImportStatus, name="source_import_status"), nullable=False
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    parameters_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    summary_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    training_items: Mapped[list["TrainingItem"]] = relationship(
        "TrainingItem", back_populates="source_import_run"
    )
    metadata_row: Mapped["LichessTacticsSourceRunMetadata | None"] = relationship(
        "LichessTacticsSourceRunMetadata", back_populates="source_import_run", uselist=False
    )
    positional_metadata_row: Mapped["ScrapedPositionalSourceRunMetadata | None"] = relationship(
        "ScrapedPositionalSourceRunMetadata", back_populates="source_import_run", uselist=False
    )


class LichessTacticsSourceRunMetadata(Base):
    __tablename__ = "lichess_tactics_source_run_metadata"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_import_run_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("source_import_runs.id"), nullable=False
    )
    imported_count: Mapped[int] = mapped_column(Integer, nullable=False)
    total_tactics_after_run: Mapped[int] = mapped_column(Integer, nullable=False)
    tactics_with_themes_count: Mapped[int] = mapped_column(Integer, nullable=False)
    tactics_with_openings_count: Mapped[int] = mapped_column(Integer, nullable=False)
    min_rating: Mapped[int] = mapped_column(Integer, nullable=False)
    max_rating: Mapped[int] = mapped_column(Integer, nullable=False)
    average_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rating_bucket_counts_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    theme_counts_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    opening_counts_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    source_import_run: Mapped[SourceImportRun] = relationship(
        "SourceImportRun", back_populates="metadata_row"
    )

    __table_args__ = (
        UniqueConstraint("source_import_run_id", name="uq_lichess_meta_source_import_run_id"),
    )


class ScrapedPositionalSourceRunMetadata(Base):
    __tablename__ = "scraped_positional_source_run_metadata"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_import_run_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("source_import_runs.id"), nullable=False
    )
    imported_count: Mapped[int] = mapped_column(Integer, nullable=False)
    skipped_existing_count: Mapped[int] = mapped_column(Integer, nullable=False)
    enrichment_failures_count: Mapped[int] = mapped_column(Integer, nullable=False)
    total_positional_after_run: Mapped[int] = mapped_column(Integer, nullable=False)
    difficulty_counts_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    theme_counts_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    source_import_run: Mapped["SourceImportRun"] = relationship(
        "SourceImportRun", back_populates="positional_metadata_row"
    )

    __table_args__ = (
        UniqueConstraint(
            "source_import_run_id",
            name="uq_scraped_positional_source_run_metadata_source_import_run_id",
        ),
    )
