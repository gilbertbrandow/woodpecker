from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from functools import lru_cache
from urllib.parse import quote

import chess
import sqlalchemy as sa
from sqlalchemy.orm import selectinload

from app.exceptions import NotFoundError
from app.extensions import db
from app.models.decoy_puzzle import DecoyPuzzle
from app.models.game import SourceGame
from app.models.lichess_tactic import LichessTactic
from app.models.opening import Opening
from app.models.scraped_positional_puzzle import ScrapedPositionalPuzzle
from app.models.training_item import TrainingItem, TrainingItemSource
from app.services.solve_contract import SolveContract


def _ply_from_fen(fen: str) -> int:
    """Return the number of half-moves played to reach the given FEN position."""
    parts = fen.split()
    if len(parts) < 6:
        return 0
    try:
        fullmove = int(parts[5])
    except ValueError:
        return 0
    return (fullmove - 1) * 2 + (1 if parts[1] == 'b' else 0)


def lichess_analysis_url(
    lichess_id: str | None,
    fen: str,
    ply: int,
    player_is_white: bool,
) -> str:
    """Build a Lichess game analysis URL, falling back to the analysis board if no game ID.

    Args:
        lichess_id: Lichess game ID, or None for OTB/unknown games.
        fen: The puzzle FEN, used as the analysis board fallback.
        ply: Half-move number to anchor to (e.g. 1 after 1.e4).
        player_is_white: True shows the board from White's side; False from Black's.
    """
    if lichess_id:
        color_suffix = "" if player_is_white else "/black"
        return f"https://lichess.org/{lichess_id}{color_suffix}#{ply}"
    return f"https://lichess.org/analysis/{quote(fen, safe='/')}"


def _game_prelude(game: SourceGame, fen: str) -> list[str]:
    """Slice game.moves to produce the prelude leading up to the puzzle FEN position.

    Requires a 6-part FEN (with halfmove and fullmove counters).  Decoy puzzles
    may arrive with 4-part FENs; callers must enrich them before calling this
    function — passing a 4-part FEN is a programming error, not a data error.
    """
    if len(fen.split()) < 6:
        raise ValueError(
            f"_game_prelude requires a 6-part FEN (halfmove + fullmove); got: {fen!r}. "
            "Enrich 4-part FENs (e.g. Decoy puzzles) before calling."
        )
    ply = _ply_from_fen(fen)
    if ply <= 0:
        return []
    return game.moves.split()[:ply]


class SourceMetadata(ABC):
    @abstractmethod
    def to_api_dict(self) -> dict[str, object]: ...


@dataclass
class LichessTacticMetadata(SourceMetadata):
    display_id: str
    rating: int
    themes: list[dict[str, str | None]] = field(default_factory=list)

    def to_api_dict(self) -> dict[str, object]:
        return {
            "sourceType": "LICHESS_TACTIC",
            "displayId": self.display_id,
            "rating": self.rating,
            "themes": self.themes,
        }


@dataclass
class ScrapedPositionalMetadata(SourceMetadata):
    internal_id: int
    difficulty: dict[str, object]
    themes: list[dict[str, str]] = field(default_factory=list)

    def to_api_dict(self) -> dict[str, object]:
        return {
            "sourceType": "SCRAPED_POSITIONAL",
            "internalId": self.internal_id,
            "difficulty": self.difficulty,
            "themes": self.themes,
        }


@dataclass
class DecoyMetadata(SourceMetadata):
    accepted_moves: list[dict[str, object]]
    best_cp: int
    move_number: int
    depth: int = 0
    themes: list[dict[str, str | None]] = field(default_factory=list)

    def to_api_dict(self) -> dict[str, object]:
        return {
            "sourceType": "DECOY",
            "acceptedMoves": self.accepted_moves,
            "bestCp": self.best_cp,
            "moveNumber": self.move_number,
            "depth": self.depth,
            "themes": self.themes,
        }


@dataclass
class TrainingItemPayload:
    contract: SolveContract
    metadata: SourceMetadata
    analysis_url: str
    training_url: str | None = None
    opening: dict | None = None
    game: dict | None = None
    rating_display: str | None = None


class TrainingItemContent(ABC):
    @abstractmethod
    def get_payload(self, training_item_id: int) -> TrainingItemPayload: ...

    @abstractmethod
    def get_payload_batch(self, training_item_ids: list[int]) -> dict[int, TrainingItemPayload]: ...


class LichessTacticContent(TrainingItemContent):
    def get_payload(self, training_item_id: int) -> TrainingItemPayload:
        tactic = db.session.execute(
            sa.select(LichessTactic)
            .options(
                selectinload(LichessTactic.themes),
                selectinload(LichessTactic.openings),
                selectinload(LichessTactic.game),
            )
            .where(LichessTactic.training_item_id == training_item_id)
        ).scalar_one()
        return _build_lichess_tactic_payload(tactic)

    def get_payload_batch(self, training_item_ids: list[int]) -> dict[int, TrainingItemPayload]:
        tactics = db.session.execute(
            sa.select(LichessTactic)
            .options(
                selectinload(LichessTactic.themes),
                selectinload(LichessTactic.openings),
                selectinload(LichessTactic.game),
            )
            .where(LichessTactic.training_item_id.in_(training_item_ids))
        ).scalars().all()
        return {t.training_item_id: _build_lichess_tactic_payload(t) for t in tactics}


class ScrapedPositionalContent(TrainingItemContent):
    def get_payload(self, training_item_id: int) -> TrainingItemPayload:
        puzzle = db.session.execute(
            sa.select(ScrapedPositionalPuzzle)
            .options(
                selectinload(ScrapedPositionalPuzzle.difficulty),
                selectinload(ScrapedPositionalPuzzle.themes),
                selectinload(ScrapedPositionalPuzzle.opening),
                selectinload(ScrapedPositionalPuzzle.game),
            )
            .where(ScrapedPositionalPuzzle.training_item_id == training_item_id)
        ).scalar_one()
        return _build_positional_payload(puzzle)

    def get_payload_batch(self, training_item_ids: list[int]) -> dict[int, TrainingItemPayload]:
        puzzles = db.session.execute(
            sa.select(ScrapedPositionalPuzzle)
            .options(
                selectinload(ScrapedPositionalPuzzle.difficulty),
                selectinload(ScrapedPositionalPuzzle.themes),
                selectinload(ScrapedPositionalPuzzle.opening),
                selectinload(ScrapedPositionalPuzzle.game),
            )
            .where(ScrapedPositionalPuzzle.training_item_id.in_(training_item_ids))
        ).scalars().all()
        return {p.training_item_id: _build_positional_payload(p) for p in puzzles}


class DecoyContent(TrainingItemContent):
    def get_payload(self, training_item_id: int) -> TrainingItemPayload:
        decoy = db.session.execute(
            sa.select(DecoyPuzzle)
            .options(selectinload(DecoyPuzzle.game).selectinload(SourceGame.opening))
            .where(DecoyPuzzle.training_item_id == training_item_id)
        ).scalar_one()
        return _build_decoy_payload(decoy)

    def get_payload_batch(self, training_item_ids: list[int]) -> dict[int, TrainingItemPayload]:
        decoys = db.session.execute(
            sa.select(DecoyPuzzle)
            .options(selectinload(DecoyPuzzle.game).selectinload(SourceGame.opening))
            .where(DecoyPuzzle.training_item_id.in_(training_item_ids))
        ).scalars().all()
        return {d.training_item_id: _build_decoy_payload(d) for d in decoys}


_CONTENT_REGISTRY: dict[TrainingItemSource, TrainingItemContent] = {
    TrainingItemSource.LICHESS_TACTIC: LichessTacticContent(),
    TrainingItemSource.SCRAPED_POSITIONAL: ScrapedPositionalContent(),
    TrainingItemSource.DECOY: DecoyContent(),
}


@lru_cache(maxsize=50_000)
def _load_payload(training_item_id: int) -> TrainingItemPayload:
    ti = db.session.get(TrainingItem, training_item_id)
    if ti is None:
        raise NotFoundError("Puzzle not found", "The requested puzzle could not be found.")
    content = _CONTENT_REGISTRY.get(ti.source_type)
    if content is None:
        raise NotImplementedError(f"No content handler for source_type {ti.source_type!r}")
    return content.get_payload(ti.id)


def get_content(training_item_id: int) -> TrainingItemPayload:
    return _load_payload(training_item_id)


def get_content_batch(training_item_ids: list[int]) -> dict[int, TrainingItemPayload]:
    if not training_item_ids:
        return {}
    items = db.session.execute(
        sa.select(TrainingItem).where(TrainingItem.id.in_(training_item_ids))
    ).scalars().all()
    result: dict[int, TrainingItemPayload] = {}
    for source_type, content in _CONTENT_REGISTRY.items():
        ids = [ti.id for ti in items if ti.source_type == source_type]
        if ids:
            result.update(content.get_payload_batch(ids))
    return result


def _parse_moves(fen: str, moves_str: str) -> list[str]:
    """Parse and validate a space-separated UCI move sequence against the given FEN.

    Walks a chess.Board from *fen*, checks every move for legality, and returns
    the canonical UCI string for each move as python-chess represents it.  This
    means castling is always returned in standard UCI form (e1g1/e1c1/e8g8/e8c8)
    regardless of how the source encoded it, and any rook move that happens to
    share a square pattern with castling (e.g. Re1-h1 in a position with no
    castling rights) is preserved correctly.

    Raises ValueError if any move is malformed or illegal in its board context.
    """
    board = chess.Board(fen)
    result = []
    for uci in moves_str.split():
        try:
            move = chess.Move.from_uci(uci)
        except ValueError as exc:
            raise ValueError(f"Malformed UCI '{uci}' in puzzle (fen={fen})") from exc
        if move not in board.legal_moves:
            raise ValueError(f"Illegal move '{uci}' in puzzle (fen={board.fen()})")
        result.append(move.uci())
        board.push(move)
    return result


def _opening_dict(opening: Opening) -> dict[str, object]:
    return {
        "name": opening.name,
        "displayName": opening.display_name,
        "eco": opening.eco,
    }


def _serialize_game(game: SourceGame) -> dict[str, object]:
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


def _build_lichess_tactic_payload(tactic: LichessTactic) -> TrainingItemPayload:
    game = tactic.game
    fen_parts = tactic.fen.split()
    # Lichess puzzle FEN is the position BEFORE the opponent's setup move (moves[0]).
    # The player acts at ply+1 (after setup). Orientation is inverted vs FEN active color.
    ply = _ply_from_fen(tactic.fen) + 1
    analysis_url = lichess_analysis_url(
        game.lichess_id,
        tactic.fen,
        ply,
        player_is_white=len(fen_parts) > 1 and fen_parts[1] == "b",
    )
    return TrainingItemPayload(
        contract=SolveContract(
            fen=tactic.fen,
            plies=_parse_moves(tactic.fen, tactic.moves),
            prelude=_game_prelude(game, tactic.fen),
        ),
        metadata=LichessTacticMetadata(
            display_id=tactic.puzzle_id,
            rating=tactic.rating,
            themes=[
                {"name": t.name, "displayName": t.display_name, "description": t.description}
                for t in tactic.themes
            ],
        ),
        analysis_url=analysis_url,
        training_url=f"https://lichess.org/training/{tactic.puzzle_id}",
        opening=_opening_dict(tactic.openings[-1]) if tactic.openings else None,
        game=_serialize_game(game),
        rating_display=str(tactic.rating),
    )


def _build_positional_payload(puzzle: ScrapedPositionalPuzzle) -> TrainingItemPayload:
    game = puzzle.game
    d = puzzle.difficulty
    fen_parts = puzzle.fen.split()
    # Same convention as Lichess tactics: FEN is before opponent's move (moves[0]).
    ply = _ply_from_fen(puzzle.fen) + 1
    analysis_url = lichess_analysis_url(
        game.lichess_id,
        puzzle.fen,
        ply,
        player_is_white=len(fen_parts) > 1 and fen_parts[1] == "b",
    )
    if d.min_rating is not None and d.max_rating is not None:
        rating_display: str | None = f"{d.min_rating}–{d.max_rating}"
    elif d.label:
        rating_display = d.label
    else:
        rating_display = None
    return TrainingItemPayload(
        contract=SolveContract(
            fen=puzzle.fen,
            plies=_parse_moves(puzzle.fen, puzzle.moves),
            prelude=_game_prelude(game, puzzle.fen),
        ),
        metadata=ScrapedPositionalMetadata(
            internal_id=puzzle.internal_id,
            difficulty={
                "value": d.value,
                "label": d.label,
                "minRating": d.min_rating,
                "maxRating": d.max_rating,
            },
            themes=[
                {"name": t.name, "displayName": t.display_name, "description": t.description}
                for t in puzzle.themes
            ],
        ),
        analysis_url=analysis_url,
        training_url=None,
        opening=_opening_dict(puzzle.opening) if puzzle.opening else None,
        game=_serialize_game(game),
        rating_display=rating_display,
    )


def _build_decoy_payload(decoy: DecoyPuzzle) -> TrainingItemPayload:
    if not isinstance(decoy.accepted_moves, list):
        raise TypeError(
            f"DecoyPuzzle {decoy.id}: accepted_moves is {type(decoy.accepted_moves).__name__}, "
            "expected list — run migration p9q0r1s2t3u4 to fix corrupt rows"
        )
    valid_moves = [m for m in decoy.accepted_moves if isinstance(m, dict) and "uci" in m]
    # FEN turn is the opponent's color; after their move it's the player's turn.
    # Player is white when FEN shows black to move → sort descending (higher cp = better for white).
    # Player is black when FEN shows white to move → sort ascending (lower cp = better for black).
    fen_parts = decoy.fen.split()
    player_is_white = len(fen_parts) > 1 and fen_parts[1] == 'b'
    valid_moves.sort(key=lambda m: m.get("cp", 0), reverse=player_is_white)
    accepted_ucis = [m["uci"] for m in valid_moves]
    decoy_lines = {
        m["uci"]: m["line"]
        for m in decoy.accepted_moves
        if isinstance(m, dict) and "uci" in m and m.get("line")
    }
    game = decoy.game
    opening = game.opening if game else None
    fullmove = decoy.move_number // 2
    fen = decoy.fen if len(decoy.fen.split()) == 6 else f"{decoy.fen} 0 {fullmove}"
    # move_number is the 1-indexed ply of the player's response; the opponent's
    # decoy is at ply move_number - 1 (SQL 1-indexed) = Python index move_number - 2.
    # game.moves stores the full sequence (Lichess) or prelude-through-opponent-move (OTB).
    opponent_move = game.moves.split()[decoy.move_number - 2]
    if game.lichess_id:
        # move_number is the player's ply; anchor to move_number-1 (after opponent's decoy, before player acts)
        analysis_url = lichess_analysis_url(game.lichess_id, fen, decoy.move_number - 1, player_is_white)
    else:
        # OTB game: push opponent_move to reach the position the player must solve
        try:
            post_board = chess.Board(fen)
            post_board.push_uci(opponent_move)
            fallback_fen = post_board.fen()
        except ValueError:
            fallback_fen = fen
        analysis_url = lichess_analysis_url(None, fallback_fen, decoy.move_number - 1, player_is_white)
    return TrainingItemPayload(
        contract=SolveContract(
            fen=fen,
            plies=[opponent_move, accepted_ucis],
            decoy_lines=decoy_lines or None,
            is_decoy=True,
            prelude=_game_prelude(game, fen),
        ),
        metadata=DecoyMetadata(
            accepted_moves=valid_moves,
            best_cp=decoy.best_cp,
            move_number=decoy.move_number,
            depth=decoy.depth,
        ),
        analysis_url=analysis_url,
        training_url=None,
        opening=_opening_dict(opening) if opening else None,
        game=_serialize_game(game) if game else None,
        rating_display=None,
    )


# Backward-compatible module-level aliases retained for tests
def _lichess_tactic_payload(training_item_id: int) -> TrainingItemPayload:
    return LichessTacticContent().get_payload(training_item_id)


def _decoy_payload(training_item_id: int) -> TrainingItemPayload:
    return DecoyContent().get_payload(training_item_id)
