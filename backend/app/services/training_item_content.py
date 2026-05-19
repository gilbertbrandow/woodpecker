from abc import ABC, abstractmethod
from dataclasses import dataclass, field

import sqlalchemy as sa
from sqlalchemy.orm import selectinload

from app.extensions import db
from app.models.lichess_tactic import LichessTactic
from app.models.training_item import TrainingItem, TrainingItemSource
from app.services.solve_contract import SolveContract


class SourceMetadata(ABC):
    @abstractmethod
    def to_api_dict(self) -> dict[str, object]: ...


@dataclass
class LichessTacticMetadata(SourceMetadata):
    display_id: str
    rating: int
    game_url: str
    themes: list[dict[str, str | None]] = field(default_factory=list)

    def to_api_dict(self) -> dict[str, object]:
        return {
            "sourceType": "LICHESS_TACTIC",
            "displayId": self.display_id,
            "rating": self.rating,
            "gameUrl": self.game_url,
            "themes": self.themes,
        }


@dataclass
class ScrapedPositionalMetadata(SourceMetadata):
    def to_api_dict(self) -> dict[str, object]:
        return {"sourceType": "SCRAPED_POSITIONAL"}


@dataclass
class DecoyMetadata(SourceMetadata):
    def to_api_dict(self) -> dict[str, object]:
        return {"sourceType": "DECOY"}


@dataclass
class TrainingItemPayload:
    contract: SolveContract
    metadata: SourceMetadata


def get_content(training_item_id: int) -> TrainingItemPayload:
    ti = db.session.get(TrainingItem, training_item_id)
    if ti is None:
        raise LookupError(f"TrainingItem {training_item_id} not found.")
    return _dispatch(ti)


def get_content_batch(training_item_ids: list[int]) -> dict[int, TrainingItemPayload]:
    if not training_item_ids:
        return {}
    items = db.session.execute(
        sa.select(TrainingItem).where(TrainingItem.id.in_(training_item_ids))
    ).scalars().all()
    result: dict[int, TrainingItemPayload] = {}
    lichess_ids = [ti.id for ti in items if ti.source_type == TrainingItemSource.LICHESS_TACTIC]
    if lichess_ids:
        result.update(_lichess_tactic_payload_batch(lichess_ids))
    # Future: add SCRAPED_POSITIONAL, DECOY batches here
    return result


def _dispatch(ti: TrainingItem) -> TrainingItemPayload:
    if ti.source_type == TrainingItemSource.LICHESS_TACTIC:
        return _lichess_tactic_payload(ti.id)
    raise NotImplementedError(f"No content handler for source_type {ti.source_type!r}")


def _lichess_tactic_payload(training_item_id: int) -> TrainingItemPayload:
    tactic = db.session.execute(
        sa.select(LichessTactic).where(LichessTactic.training_item_id == training_item_id)
    ).scalar_one()
    return TrainingItemPayload(
        contract=SolveContract(
            fen=tactic.fen,
            plies=tactic.moves.split(),
        ),
        metadata=LichessTacticMetadata(
            display_id=tactic.puzzle_id,
            rating=tactic.rating,
            game_url=tactic.game_url,
            themes=[{"name": t.name, "displayName": t.display_name} for t in tactic.themes],
        ),
    )


def _lichess_tactic_payload_batch(
    training_item_ids: list[int],
) -> dict[int, TrainingItemPayload]:
    tactics = db.session.execute(
        sa.select(LichessTactic)
        .options(selectinload(LichessTactic.themes))
        .where(LichessTactic.training_item_id.in_(training_item_ids))
    ).scalars().all()
    return {
        t.training_item_id: TrainingItemPayload(
            contract=SolveContract(
                fen=t.fen,
                plies=t.moves.split(),
            ),
            metadata=LichessTacticMetadata(
                display_id=t.puzzle_id,
                rating=t.rating,
                game_url=t.game_url,
                themes=[{"name": th.name, "displayName": th.display_name} for th in t.themes],
            ),
        )
        for t in tactics
    }
