from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass, field
from urllib.parse import quote

import chess
import sqlalchemy as sa
from sqlalchemy.orm import selectinload

from app.exceptions import NotFoundError
from app.extensions import db
from app.models.decoy_puzzle import DecoyPuzzle
from app.models.game import Game
from app.models.lichess_tactic import LichessTactic
from app.models.opening import Opening
from app.models.scraped_positional_puzzle import ScrapedPositionalPuzzle
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
    opening: dict[str, object] | None = None

    def to_api_dict(self) -> dict[str, object]:
        return {
            "sourceType": "LICHESS_TACTIC",
            "displayId": self.display_id,
            "rating": self.rating,
            "gameUrl": self.game_url,
            "themes": self.themes,
            "opening": self.opening,
        }


@dataclass
class ScrapedPositionalMetadata(SourceMetadata):
    internal_id: int
    lichess_url: str
    difficulty: dict[str, object]
    themes: list[dict[str, str]] = field(default_factory=list)
    opening: dict[str, object] | None = None

    def to_api_dict(self) -> dict[str, object]:
        return {
            "sourceType": "SCRAPED_POSITIONAL",
            "internalId": self.internal_id,
            "lichessUrl": self.lichess_url,
            "difficulty": self.difficulty,
            "themes": self.themes,
            "opening": self.opening,
        }


@dataclass
class DecoyMetadata(SourceMetadata):
    accepted_moves: list[dict[str, object]]
    best_cp: int
    move_number: int
    depth: int = 0
    analysis_url: str | None = None
    game: dict[str, object] | None = None
    opening: dict[str, object] | None = None

    def to_api_dict(self) -> dict[str, object]:
        return {
            "sourceType": "DECOY",
            "acceptedMoves": self.accepted_moves,
            "bestCp": self.best_cp,
            "moveNumber": self.move_number,
            "depth": self.depth,
            "analysisUrl": self.analysis_url,
            "game": self.game,
            "opening": self.opening,
        }


@dataclass
class TrainingItemPayload:
    contract: SolveContract
    metadata: SourceMetadata


_HANDLERS: dict[TrainingItemSource, tuple[
    Callable[[int], TrainingItemPayload],
    Callable[[list[int]], dict[int, TrainingItemPayload]],
]] = {}


def _register_handlers() -> None:
    _HANDLERS[TrainingItemSource.LICHESS_TACTIC] = (_lichess_tactic_payload, _lichess_tactic_payload_batch)
    _HANDLERS[TrainingItemSource.SCRAPED_POSITIONAL] = (_scraped_positional_payload, _scraped_positional_payload_batch)
    _HANDLERS[TrainingItemSource.DECOY] = (_decoy_payload, _decoy_payload_batch)


def get_content(training_item_id: int) -> TrainingItemPayload:
    ti = db.session.get(TrainingItem, training_item_id)
    if ti is None:
        raise NotFoundError("Puzzle not found", "The requested puzzle could not be found.")
    return _dispatch(ti)


def get_content_batch(training_item_ids: list[int]) -> dict[int, TrainingItemPayload]:
    if not training_item_ids:
        return {}
    items = db.session.execute(
        sa.select(TrainingItem).where(TrainingItem.id.in_(training_item_ids))
    ).scalars().all()
    result: dict[int, TrainingItemPayload] = {}
    for source_type, (_, batch_handler) in _HANDLERS.items():
        ids = [ti.id for ti in items if ti.source_type == source_type]
        if ids:
            result.update(batch_handler(ids))
    return result


def _dispatch(ti: TrainingItem) -> TrainingItemPayload:
    handler = _HANDLERS.get(ti.source_type)
    if handler is None:
        raise NotImplementedError(f"No content handler for source_type {ti.source_type!r}")
    return handler[0](ti.id)


def _lichess_tactic_payload(training_item_id: int) -> TrainingItemPayload:
    tactic = db.session.execute(
        sa.select(LichessTactic)
        .options(selectinload(LichessTactic.themes), selectinload(LichessTactic.openings))
        .where(LichessTactic.training_item_id == training_item_id)
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
            opening=_opening_dict(tactic.openings[-1]) if tactic.openings else None,
        ),
    )


def _lichess_tactic_payload_batch(
    training_item_ids: list[int],
) -> dict[int, TrainingItemPayload]:
    tactics = db.session.execute(
        sa.select(LichessTactic)
        .options(selectinload(LichessTactic.themes), selectinload(LichessTactic.openings))
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
                opening=_opening_dict(t.openings[-1]) if t.openings else None,
            ),
        )
        for t in tactics
    }


def _scraped_positional_payload(training_item_id: int) -> TrainingItemPayload:
    puzzle = db.session.execute(
        sa.select(ScrapedPositionalPuzzle)
        .options(
            selectinload(ScrapedPositionalPuzzle.difficulty),
            selectinload(ScrapedPositionalPuzzle.themes),
            selectinload(ScrapedPositionalPuzzle.opening),
        )
        .where(ScrapedPositionalPuzzle.training_item_id == training_item_id)
    ).scalar_one()
    return _build_positional_payload(puzzle)


def _scraped_positional_payload_batch(
    training_item_ids: list[int],
) -> dict[int, TrainingItemPayload]:
    puzzles = db.session.execute(
        sa.select(ScrapedPositionalPuzzle)
        .options(
            selectinload(ScrapedPositionalPuzzle.difficulty),
            selectinload(ScrapedPositionalPuzzle.themes),
            selectinload(ScrapedPositionalPuzzle.opening),
        )
        .where(ScrapedPositionalPuzzle.training_item_id.in_(training_item_ids))
    ).scalars().all()
    return {p.training_item_id: _build_positional_payload(p) for p in puzzles}


def _build_positional_payload(puzzle: ScrapedPositionalPuzzle) -> TrainingItemPayload:
    d = puzzle.difficulty
    return TrainingItemPayload(
        contract=SolveContract(
            fen=puzzle.fen,
            plies=puzzle.moves.split(),
        ),
        metadata=ScrapedPositionalMetadata(
            internal_id=puzzle.internal_id,
            lichess_url=puzzle.lichess_url,
            difficulty={
                "value": d.value,
                "label": d.label,
                "minRating": d.min_rating,
                "maxRating": d.max_rating,
            },
            themes=[{"name": t.name, "displayName": t.display_name} for t in puzzle.themes],
            opening=_opening_dict(puzzle.opening) if puzzle.opening else None,
        ),
    )


def _opening_dict(opening: Opening) -> dict[str, object]:
    return {
        "name": opening.name,
        "displayName": opening.display_name,
        "eco": opening.eco,
    }


def _decoy_payload(training_item_id: int) -> TrainingItemPayload:
    decoy = db.session.execute(
        sa.select(DecoyPuzzle)
        .options(selectinload(DecoyPuzzle.game).selectinload(Game.opening))
        .where(DecoyPuzzle.training_item_id == training_item_id)
    ).scalar_one()
    return _build_decoy_payload(decoy)


def _decoy_payload_batch(training_item_ids: list[int]) -> dict[int, TrainingItemPayload]:
    decoys = db.session.execute(
        sa.select(DecoyPuzzle)
        .options(selectinload(DecoyPuzzle.game).selectinload(Game.opening))
        .where(DecoyPuzzle.training_item_id.in_(training_item_ids))
    ).scalars().all()
    return {d.training_item_id: _build_decoy_payload(d) for d in decoys}


def _serialize_game(game: Game) -> dict[str, object]:
    return {
        "white": game.white,
        "black": game.black,
        "whiteTitle": game.white_title,
        "blackTitle": game.black_title,
        "whiteElo": game.white_elo,
        "blackElo": game.black_elo,
        "event": game.event,
        "date": game.date,
        "lichessId": game.lichess_id,
    }


def _build_decoy_payload(decoy: DecoyPuzzle) -> TrainingItemPayload:
    accepted_ucis = [m["uci"] for m in decoy.accepted_moves if isinstance(m, dict) and "uci" in m]
    decoy_lines = {
        m["uci"]: m["line"]
        for m in decoy.accepted_moves
        if isinstance(m, dict) and "uci" in m and m.get("line")
    }
    game = decoy.game
    opening = game.opening if game else None
    fullmove = decoy.move_number // 2
    fen = decoy.fen if len(decoy.fen.split()) == 6 else f"{decoy.fen} 0 {fullmove}"
    if decoy.analysis_url:
        analysis_url = decoy.analysis_url
    else:
        try:
            post_board = chess.Board(fen)
            post_board.push_uci(decoy.opponent_move)
            analysis_url = f"https://lichess.org/analysis/{quote(post_board.fen(), safe='/')}"
        except Exception:
            analysis_url = f"https://lichess.org/analysis/{quote(fen, safe='/')}"
    return TrainingItemPayload(
        contract=SolveContract(
            fen=fen,
            plies=[decoy.opponent_move, accepted_ucis],
            decoy_lines=decoy_lines or None,
            is_decoy=True,
        ),
        metadata=DecoyMetadata(
            accepted_moves=list(decoy.accepted_moves),
            best_cp=decoy.best_cp,
            move_number=decoy.move_number,
            depth=decoy.depth,
            analysis_url=analysis_url,
            game=_serialize_game(game) if game else None,
            opening=_opening_dict(opening) if opening else None,
        ),
    )


_register_handlers()
