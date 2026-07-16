from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.extensions import db
from app.models.decoy_puzzle import DecoyPuzzle
from app.models.game import Game
from app.models.opening import Opening
from app.models.source_import_run import (
    DecoySourceRunMetadata,
    SourceImportRun,
    SourceImportSource,
    SourceImportStatus,
)
from app.services.training_item_content import _serialize_game
from app.table_query import FilterList


def _serialize_puzzle(dp: DecoyPuzzle) -> dict:
    game = dp.game
    opening = game.opening if game else None
    return {
        "id": dp.id,
        "fen": dp.fen,
        "opponentMove": dp.opponent_move,
        "acceptedMoves": dp.accepted_moves,
        "bestCp": dp.best_cp,
        "depth": dp.depth,
        "moveNumber": dp.move_number,
        "analysisUrl": dp.analysis_url,
        "opening": (
            {"name": opening.name, "displayName": opening.display_name, "eco": opening.eco}
            if opening else None
        ),
        "game": _serialize_game(game) if game else None,
    }


def list_items(page: int, page_size: int, opening: FilterList) -> dict:
    conditions = []

    opening_name = opening.str_values[0] if opening.str_values else None
    if opening_name:
        opening_id_subq = (
            select(Opening.id)
            .where(Opening.name == opening_name)
            .scalar_subquery()
        )
        conditions.append(Game.opening_id == opening_id_subq)

    base_q = (
        select(DecoyPuzzle)
        .join(Game, Game.id == DecoyPuzzle.game_id, isouter=True)
        .where(*conditions)
    )

    total: int = db.session.execute(
        select(func.count()).select_from(base_q.subquery())
    ).scalar_one()

    offset = (page - 1) * page_size
    puzzles = list(
        db.session.execute(
            base_q
            .options(
                selectinload(DecoyPuzzle.game).selectinload(Game.opening),
            )
            .order_by(DecoyPuzzle.id)
            .limit(page_size)
            .offset(offset)
        ).scalars()
    )

    total_pages = max(1, (total + page_size - 1) // page_size)

    return {
        "puzzles": [_serialize_puzzle(p) for p in puzzles],
        "page": page,
        "pageSize": page_size,
        "totalPages": total_pages,
        "total": total,
    }


def get_latest_source_run_metadata() -> dict | None:
    row = db.session.execute(
        select(DecoySourceRunMetadata)
        .join(
            SourceImportRun,
            SourceImportRun.id == DecoySourceRunMetadata.source_import_run_id,
        )
        .where(
            SourceImportRun.source == SourceImportSource.DECOY,
            SourceImportRun.status == SourceImportStatus.SUCCEEDED,
        )
        .order_by(SourceImportRun.finished_at.desc())
        .limit(1)
    ).scalar_one_or_none()

    if row is None:
        return None

    top_openings = sorted(
        ((k, v) for k, v in row.opening_counts_json.items() if k != "Unknown"),
        key=lambda x: x[1],
        reverse=True,
    )[:15]

    return {
        "totalDecoysAfterRun": row.total_decoys_after_run,
        "importedCount": row.imported_count,
        "topOpenings": [
            {"displayName": display_name, "count": int(count)}
            for display_name, count in top_openings
        ],
        "generatedAt": row.generated_at.isoformat(),
    }
