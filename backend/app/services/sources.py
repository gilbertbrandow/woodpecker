from sqlalchemy import case, func, select

from app.extensions import db
from app.models.source_import_run import SourceImportRun, SourceImportSource, SourceImportStatus
from app.models.training_item import TrainingItem, TrainingItemSource

_IMPORT_TO_TRAINING_SOURCE: dict[SourceImportSource, TrainingItemSource] = {
    SourceImportSource.LICHESS_TACTICS: TrainingItemSource.LICHESS_TACTIC,
    SourceImportSource.SCRAPED_POSITIONAL: TrainingItemSource.SCRAPED_POSITIONAL,
    SourceImportSource.DECOY: TrainingItemSource.DECOY,
}

_SOURCE_DISPLAY: dict[SourceImportSource, dict] = {
    SourceImportSource.LICHESS_TACTICS: {"sourceType": "LICHESS_TACTIC", "name": "Lichess Tactics"},
    SourceImportSource.SCRAPED_POSITIONAL: {"sourceType": "SCRAPED_POSITIONAL", "name": "Scraped Positional"},
    SourceImportSource.DECOY: {"sourceType": "DECOY", "name": "Decoys"},
}


def list_sources() -> list[dict]:
    import_rows = db.session.execute(
        select(
            SourceImportRun.source,
            func.min(SourceImportRun.started_at).label("first_imported"),
            func.max(
                case(
                    (SourceImportRun.status == SourceImportStatus.SUCCEEDED, SourceImportRun.finished_at),
                    else_=None,
                )
            ).label("last_synced"),
        ).group_by(SourceImportRun.source)
    ).all()

    import_map = {row.source: row for row in import_rows}

    count_rows = db.session.execute(
        select(
            TrainingItem.source_type,
            func.count(TrainingItem.id).label("count"),
        ).group_by(TrainingItem.source_type)
    ).all()

    count_map = {row.source_type: row.count for row in count_rows}

    result = []
    for import_source, display in _SOURCE_DISPLAY.items():
        training_source = _IMPORT_TO_TRAINING_SOURCE[import_source]
        stats = import_map.get(import_source)
        result.append({
            **display,
            "puzzleCount": count_map.get(training_source, 0),
            "firstImported": stats.first_imported.isoformat() if stats and stats.first_imported else None,
            "lastSynced": stats.last_synced.isoformat() if stats and stats.last_synced else None,
        })

    return result
