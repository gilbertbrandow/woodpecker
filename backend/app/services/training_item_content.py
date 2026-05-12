from dataclasses import dataclass, field

import sqlalchemy as sa
from sqlalchemy.orm import selectinload

from app.extensions import db
from app.models.lichess_tactic import LichessTactic
from app.models.training_item import TrainingItem, TrainingItemSource


@dataclass
class TrainingItemContent:
    display_id: str
    fen: str
    moves: str
    rating: int
    game_url: str
    themes: list[dict[str, str | None]] = field(default_factory=list)


def get_content(training_item_id: int) -> TrainingItemContent:
    ti = db.session.get(TrainingItem, training_item_id)
    if ti is None:
        raise LookupError(f"TrainingItem {training_item_id} not found.")
    return _dispatch(ti)


def get_content_batch(training_item_ids: list[int]) -> dict[int, TrainingItemContent]:
    if not training_item_ids:
        return {}
    items = db.session.execute(
        sa.select(TrainingItem).where(TrainingItem.id.in_(training_item_ids))
    ).scalars().all()
    result: dict[int, TrainingItemContent] = {}
    lichess_ids = [ti.id for ti in items if ti.source_type == TrainingItemSource.LICHESS_TACTIC]
    if lichess_ids:
        result.update(_lichess_tactic_content_batch(lichess_ids))
    # Future: add DECOY, POSITIONAL batches here
    return result


def _dispatch(ti: TrainingItem) -> TrainingItemContent:
    if ti.source_type == TrainingItemSource.LICHESS_TACTIC:
        return _lichess_tactic_content(ti.id)
    raise NotImplementedError(f"No content handler for source_type {ti.source_type!r}")


def _lichess_tactic_content(training_item_id: int) -> TrainingItemContent:
    tactic = db.session.execute(
        sa.select(LichessTactic).where(LichessTactic.training_item_id == training_item_id)
    ).scalar_one()
    return TrainingItemContent(
        display_id=tactic.puzzle_id,
        fen=tactic.fen,
        moves=tactic.moves,
        rating=tactic.rating,
        game_url=tactic.game_url,
        themes=[{"name": t.name, "displayName": t.display_name} for t in tactic.themes],
    )


def _lichess_tactic_content_batch(
    training_item_ids: list[int],
) -> dict[int, TrainingItemContent]:
    tactics = db.session.execute(
        sa.select(LichessTactic)
        .options(selectinload(LichessTactic.themes))
        .where(LichessTactic.training_item_id.in_(training_item_ids))
    ).scalars().all()
    return {
        t.training_item_id: TrainingItemContent(
            display_id=t.puzzle_id,
            fen=t.fen,
            moves=t.moves,
            rating=t.rating,
            game_url=t.game_url,
            themes=[{"name": th.name, "displayName": th.display_name} for th in t.themes],
        )
        for t in tactics
    }
