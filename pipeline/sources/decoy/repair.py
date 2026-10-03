"""One-off repair of decoy puzzle → source game links (#398).

Earlier dataset/import bugs left decoy games wrong in three ways:
  - Games without a Lichess ID stored only the prelude moves (up to the puzzle).
  - The importer identified such games by (white, black, event, date) only, so
    several games from the same match day were merged into one row.
  - The dataset assigned some records another game's Lichess ID (decoys#7), so
    puzzles were linked to a Lichess game that never reaches their position.

The (fixed) dataset is the source of truth: every decoy puzzle ends up linked to
the row for its own game, with that game's full moves. Rows are fixed in place
where safe, otherwise puzzles are relinked to an existing or newly created row.
Rows left without any reference are deleted.

Before committing, every decoy puzzle is checked against the dataset; if any
check fails the whole transaction is rolled back.
"""
import json
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import chess
from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.models.decoy_puzzle import DecoyPuzzle
from app.models.game import SourceGame as Game
from app.models.lichess_tactic import LichessTactic
from app.models.scraped_positional_puzzle import ScrapedPositionalPuzzle
from sources.decoy.importer import (
    OtbGameKey,
    _lichess_id_from_url,
    _load_opening_caches,
    find_otb_game_id,
    new_game_from_item,
    otb_game_key,
)


_SYNCED_COLUMNS = (
    "lichess_id", "moves", "white", "black", "white_elo", "black_elo",
    "white_title", "black_title", "event", "date", "eco", "opening_id",
)


@dataclass(frozen=True)
class GameIdentity:
    """A game's identity in the dataset: its Lichess ID, or the OTB key when it has none."""

    lichess_id: str | None
    otb_key: OtbGameKey | None


@dataclass
class RepairReport:
    stats: Counter[str] = field(default_factory=Counter)
    problems: Counter[str] = field(default_factory=Counter)
    applied: bool = False


def _identity(item: dict[str, Any]) -> GameIdentity:
    url = item.get("lichessGameUrl")
    lichess_id = _lichess_id_from_url(url) if url else None
    if lichess_id:
        return GameIdentity(lichess_id=lichess_id, otb_key=None)
    return GameIdentity(lichess_id=None, otb_key=otb_game_key(item))


def _row_identity(game: Game) -> GameIdentity:
    if game.lichess_id:
        return GameIdentity(lichess_id=game.lichess_id, otb_key=None)
    return GameIdentity(
        lichess_id=None,
        otb_key=(game.white, game.black, game.event, game.date, " ".join(game.moves.split())),
    )


def reaches_fen(moves: str, fen: str) -> bool:
    """True if replaying `moves` from the start passes through `fen` (board, side, castling)."""
    target = fen.split()[:3]
    board = chess.Board()
    for uci in moves.split():
        if board.fen().split()[:3] == target:
            return True
        board.push_uci(uci)
    return board.fen().split()[:3] == target


def _referenced_outside_decoys(session: Session, game_id: int) -> bool:
    return bool(session.scalar(select(
        exists().where(LichessTactic.game_id == game_id)
        | exists().where(ScrapedPositionalPuzzle.game_id == game_id)
    )))


def _is_referenced(session: Session, game_id: int) -> bool:
    return bool(session.scalar(select(exists().where(DecoyPuzzle.game_id == game_id)))) or (
        _referenced_outside_decoys(session, game_id)
    )


class _Healer:
    def __init__(self, session: Session, items: dict[str, dict[str, Any]]) -> None:
        self.session = session
        self.items = items
        self.stats: Counter[str] = Counter()
        self.opening_by_display_name, self.opening_by_eco = _load_opening_caches(session)

    def _find(self, identity: GameIdentity) -> int | None:
        if identity.lichess_id:
            return self.session.execute(
                select(Game.id).where(Game.lichess_id == identity.lichess_id)
            ).scalar_one_or_none()
        assert identity.otb_key is not None
        return find_otb_game_id(self.session, identity.otb_key)

    def _desired(self, item: dict[str, Any], identity: GameIdentity, run_id: int) -> Game:
        return new_game_from_item(
            item, identity.lichess_id, run_id, self.opening_by_display_name, self.opening_by_eco,
        )

    def _sync(self, game: Game, item: dict[str, Any], identity: GameIdentity) -> None:
        """Make `game` hold exactly the dataset game for `identity`."""
        desired = self._desired(item, identity, game.source_import_run_id)
        changes = {
            col: getattr(desired, col) for col in _SYNCED_COLUMNS
            if getattr(game, col) != getattr(desired, col)
        }
        # Several openings share an ECO code and the lookup picks one arbitrarily;
        # keep the existing opening unless the ECO itself changed.
        if game.opening_id is not None and "eco" not in changes:
            changes.pop("opening_id", None)
        if not changes:
            self.stats["games_already_correct"] += 1
            return
        if _referenced_outside_decoys(self.session, game.id):
            self.stats["games_skipped_shared_with_other_sources"] += 1
            return
        for col, value in changes.items():
            setattr(game, col, value)
        self.session.flush()
        self.stats["games_updated"] += 1

    def heal_game(self, game: Game, puzzles: list[DecoyPuzzle]) -> None:
        groups: dict[GameIdentity, list[DecoyPuzzle]] = defaultdict(list)
        group_item: dict[GameIdentity, dict[str, Any]] = {}
        for puzzle in puzzles:
            item = self.items.get(puzzle.fen)
            if item is None or not item.get("game_moves"):
                self.stats["puzzles_skipped_no_dataset_record"] += 1
                continue
            if not reaches_fen(item["game_moves"], puzzle.fen):
                self.stats["puzzles_skipped_dataset_moves_miss_fen"] += 1
                continue
            identity = _identity(item)
            groups[identity].append(puzzle)
            group_item.setdefault(identity, item)

        current = _row_identity(game)
        if set(groups) <= {current}:
            # Every puzzle already points at its own game; at most the row's columns differ.
            if groups:
                self._sync(game, group_item[current], current)
            return

        if game.lichess_id:
            # A Lichess row is never repurposed: it keeps its own ID or nothing.
            keep = current if current in groups else None
        else:
            # An OTB row keeps the identity it most likely came from (prefix of the
            # full game, then most puzzles), unless that game already has a row.
            candidates = [i for i in groups if self._find(i) in (None, game.id)]
            stored = game.moves.split()
            keep = max(
                candidates,
                key=lambda i: (
                    group_item[i]["game_moves"].split()[: len(stored)] == stored,
                    len(groups[i]),
                ),
                default=None,
            )

        for identity, members in groups.items():
            item = group_item[identity]
            if identity == keep:
                self._sync(game, item, identity)
                continue
            target_id = self._find(identity)
            if target_id is None:
                new_game = self._desired(item, identity, game.source_import_run_id)
                self.session.add(new_game)
                self.session.flush()
                target_id = new_game.id
                self.stats["games_created"] += 1
            for puzzle in members:
                puzzle.game_id = target_id
                self.stats["puzzles_relinked"] += 1
        self.session.flush()

        if keep is None and not _is_referenced(self.session, game.id):
            self.session.delete(game)
            self.session.flush()
            self.stats["orphaned_games_deleted"] += 1


def _verify(session: Session, items: dict[str, dict[str, Any]]) -> Counter[str]:
    """Check every decoy puzzle's game against the dataset. Empty result = healthy."""
    problems: Counter[str] = Counter()
    for fen, game in session.execute(
        select(DecoyPuzzle.fen, Game).join(Game, DecoyPuzzle.game_id == Game.id)
    ).all():
        item = items.get(fen)
        if item is None or not item.get("game_moves"):
            continue
        if _row_identity(game) != _identity(item):
            problems["puzzle linked to a different game than the dataset says"] += 1
        if game.moves != " ".join(item["game_moves"].split()):
            problems["game moves differ from dataset"] += 1
        if not reaches_fen(game.moves, fen):
            problems["game does not reach puzzle fen"] += 1

    decoy_game_ids = select(DecoyPuzzle.game_id)
    otb_keys = Counter(
        _row_identity(game)
        for game in session.scalars(
            select(Game).where(Game.lichess_id.is_(None), Game.id.in_(decoy_game_ids))
        )
    )
    problems["duplicate otb game rows"] = sum(n - 1 for n in otb_keys.values() if n > 1)
    return +problems


def repair_decoy_games(session: Session, file: Path, apply: bool) -> RepairReport:
    items: dict[str, dict[str, Any]] = {}
    with file.open() as fh:
        for line in fh:
            if line.strip():
                item = json.loads(line)
                items[item["fen"]] = item

    healer = _Healer(session, items)
    puzzles_by_game: dict[int, list[DecoyPuzzle]] = defaultdict(list)
    games: dict[int, Game] = {}
    for puzzle, game in session.execute(
        select(DecoyPuzzle, Game).join(Game, DecoyPuzzle.game_id == Game.id)
    ).all():
        puzzles_by_game[game.id].append(puzzle)
        games[game.id] = game
    for game_id, puzzles in puzzles_by_game.items():
        healer.heal_game(games[game_id], puzzles)

    report = RepairReport(stats=healer.stats, problems=_verify(session, items))
    if apply and not report.problems:
        session.commit()
        report.applied = True
    else:
        session.rollback()
    return report
