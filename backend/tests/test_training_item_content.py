from unittest.mock import MagicMock, patch

import pytest

from app.models.training_item import TrainingItemSource
from app.services.solve_contract import SolveContract
from app.services.training_item_content import (
    DecoyMetadata,
    LichessTacticMetadata,
    _dispatch,
    _decoy_payload,
    _lichess_tactic_payload,
    get_content_batch,
)


def _stub_tactic(
    *,
    training_item_id: int = 1,
    moves: str = "e2e4 d7d5",
    puzzle_id: str = "abc123",
    rating: int = 1500,
    game_url: str = "https://lichess.org/game/abc",
    themes: list | None = None,
) -> MagicMock:
    t = MagicMock()
    t.training_item_id = training_item_id
    t.moves = moves
    t.puzzle_id = puzzle_id
    t.rating = rating
    t.game_url = game_url
    t.themes = themes or []
    return t


def test_lichess_payload_splits_moves_into_plies() -> None:
    tactic = _stub_tactic(moves="e2e4 d7d5 e4d5 d8d5")
    with patch("app.services.training_item_content.db") as mock_db:
        mock_db.session.execute.return_value.scalar_one.return_value = tactic
        payload = _lichess_tactic_payload(1)
    assert isinstance(payload.contract, SolveContract)
    assert list(payload.contract.plies) == ["e2e4", "d7d5", "e4d5", "d8d5"]


def test_lichess_payload_maps_metadata_fields() -> None:
    tactic = _stub_tactic(puzzle_id="xyz99", rating=1800, game_url="https://lichess.org/g/xyz")
    with patch("app.services.training_item_content.db") as mock_db:
        mock_db.session.execute.return_value.scalar_one.return_value = tactic
        payload = _lichess_tactic_payload(1)
    assert isinstance(payload.metadata, LichessTacticMetadata)
    assert payload.metadata.display_id == "xyz99"
    assert payload.metadata.rating == 1800
    assert payload.metadata.game_url == "https://lichess.org/g/xyz"


def test_lichess_metadata_to_api_dict_has_source_type_discriminant() -> None:
    tactic = _stub_tactic()
    with patch("app.services.training_item_content.db") as mock_db:
        mock_db.session.execute.return_value.scalar_one.return_value = tactic
        payload = _lichess_tactic_payload(1)
    api = payload.metadata.to_api_dict()
    assert api["sourceType"] == "LICHESS_TACTIC"
    assert api["displayId"] == "abc123"
    assert api["rating"] == 1500


def _stub_decoy(
    *,
    training_item_id: int = 10,
    fen: str = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    opponent_move: str = "e2e4",
    accepted_moves: list | None = None,
    best_cp: int = 12,
) -> MagicMock:
    d = MagicMock()
    d.training_item_id = training_item_id
    d.fen = fen
    d.opponent_move = opponent_move
    d.accepted_moves = accepted_moves or [
        {"uci": "e7e5", "cp": 12, "dropCp": 0, "line": "e7e5"},
        {"uci": "c7c5", "cp": 8, "dropCp": 4, "line": "c7c5"},
        {"uci": "g8f6", "cp": 5, "dropCp": 7, "line": "g8f6"},
    ]
    d.best_cp = best_cp
    d.game = None
    return d


def test_decoy_payload_builds_set_match_solve_contract() -> None:
    decoy = _stub_decoy()
    with patch("app.services.training_item_content.db") as mock_db:
        mock_db.session.execute.return_value.scalar_one.return_value = decoy
        payload = _decoy_payload(10)
    assert isinstance(payload.contract, SolveContract)
    assert payload.contract.fen == decoy.fen
    assert list(payload.contract.plies) == ["e2e4", ["e7e5", "c7c5", "g8f6"]]


def test_decoy_metadata_to_api_dict_has_correct_shape() -> None:
    decoy = _stub_decoy()
    with patch("app.services.training_item_content.db") as mock_db:
        mock_db.session.execute.return_value.scalar_one.return_value = decoy
        payload = _decoy_payload(10)
    assert isinstance(payload.metadata, DecoyMetadata)
    api = payload.metadata.to_api_dict()
    assert api["sourceType"] == "DECOY"
    assert api["bestCp"] == 12
    assert len(api["acceptedMoves"]) == 3  # type: ignore[arg-type]
    assert api["opening"] is None


def test_get_content_batch_with_empty_list_returns_empty_dict() -> None:
    result = get_content_batch([])
    assert result == {}
