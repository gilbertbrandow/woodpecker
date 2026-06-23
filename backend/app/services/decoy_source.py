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

ITEMS_PAGE_SIZE = 20


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
        "game": (
            {
                "white": game.white,
                "black": game.black,
                "whiteTitle": game.white_title,
                "blackTitle": game.black_title,
                "event": game.event,
                "date": game.date,
                "lichessId": game.lichess_id,
            }
            if game else None
        ),
    }


def list_items(page: int, opening_name: str | None) -> dict:
    conditions = []

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

    offset = (page - 1) * ITEMS_PAGE_SIZE
    puzzles = list(
        db.session.execute(
            base_q
            .options(
                selectinload(DecoyPuzzle.game).selectinload(Game.opening),
            )
            .order_by(DecoyPuzzle.id)
            .limit(ITEMS_PAGE_SIZE)
            .offset(offset)
        ).scalars()
    )

    total_pages = max(1, (total + ITEMS_PAGE_SIZE - 1) // ITEMS_PAGE_SIZE)

    return {
        "puzzles": [_serialize_puzzle(p) for p in puzzles],
        "page": page,
        "pageSize": ITEMS_PAGE_SIZE,
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
        row.opening_counts_json.items(), key=lambda x: x[1], reverse=True
    )[:15]

    return {
        "totalDecoysAfterRun": row.total_decoys_after_run,
        "importedCount": row.imported_count,
        "topOpenings": [
            {"displayName": display_name, "count": int(count)}
            for display_name, count in top_openings
            if display_name != "Unknown"
        ],
        "generatedAt": row.generated_at.isoformat(),
    }
