from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models.source_import_run import (
    SourceImportOperation,
    SourceImportRun,
    SourceImportSource,
    SourceImportStatus,
)


def execute_import_run(
    session: Session,
    *,
    source: SourceImportSource,
    operation: SourceImportOperation,
    parameters: dict[str, Any],
    summary_keys: list[str],
    fn: Callable[[Session, int], dict[str, Any]],
    metadata_factory: Callable[[int, dict[str, Any], datetime], Any],
) -> None:
    run = SourceImportRun(
        source=source,
        operation=operation,
        status=SourceImportStatus.RUNNING,
        started_at=datetime.now(timezone.utc),
        parameters_json=parameters,
    )
    session.add(run)
    session.commit()
    run_id = run.id

    try:
        stats = fn(session, run_id)

        session.add(metadata_factory(run_id, stats, datetime.now(timezone.utc)))

        run.status = SourceImportStatus.SUCCEEDED
        run.finished_at = datetime.now(timezone.utc)
        run.summary_json = {k: stats[k] for k in summary_keys if k in stats}
        session.commit()

    except Exception as e:
        session.rollback()
        run.status = SourceImportStatus.FAILED
        run.finished_at = datetime.now(timezone.utc)
        run.error_message = str(e)[:2000]
        session.commit()
        raise
