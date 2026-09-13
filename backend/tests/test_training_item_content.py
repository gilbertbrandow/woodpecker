from unittest.mock import MagicMock, patch

import pytest

from app.services.solve_contract import SolveContract
from app.services.training_item_content import (
    DecoyMetadata,
    LichessTacticMetadata,
    _decoy_payload,
    _lichess_tactic_payload,
    _parse_moves,
    get_content_batch,
)

STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


def _stub_tactic(
    *,
    training_item_id: int = 1,
    fen: str = STARTING_FEN,
    moves: str = "e2e4 d7d5",
    puzzle_id: str = "abc123",
    rating: int = 1500,
    game_url: str = "https://lichess.org/game/abc",
    themes: list | None = None,
) -> MagicMock:
    t = MagicMock()
    t.training_item_id = training_item_id
    t.fen = fen
    t.moves = moves
    t.puzzle_id = puzzle_id
    t.rating = rating
    t.game_url = game_url
    t.themes = themes or []
    t.openings = []
    return t


# ── _parse_moves ─────────────────────────────────────────────────────────────

def test_parse_moves_accepts_legal_move_sequence() -> None:
    result = _parse_moves(STARTING_FEN, "e2e4 d7d5 e4d5 d8d5")
    assert result == ["e2e4", "d7d5", "e4d5", "d8d5"]


def test_parse_moves_raises_on_illegal_move() -> None:
    with pytest.raises(ValueError, match="Illegal move"):
        _parse_moves(STARTING_FEN, "e2e4 e2e4")  # e2 is empty after the first push


def test_parse_moves_raises_on_malformed_uci() -> None:
    with pytest.raises(ValueError):
        _parse_moves(STARTING_FEN, "e2e4 notauci")


def test_parse_moves_rook_move_matching_chess960_castling_pattern_is_not_normalised() -> None:
    # Regression test for puzzle 3zU62 (training item 431417).
    # White rook goes e1→h1 (Re1h1) in a position where castling rights are gone.
    # The old string-substitution normaliser converted this to e1g1, drifting the
    # board and causing an AssertionError six moves later when h1h2 was attempted.
    fen = "1r4k1/p5pp/1p1p1r2/1PpPp1q1/P3Bb2/3P1PP1/6KP/R2QR3 w - - 3 22"
    moves = "g2f2 f6h6 e1h1 h6h2 h1h2 g5g3 f2f1 g3h2"
    result = _parse_moves(fen, moves)
    assert result == moves.split()


def test_parse_moves_returns_standard_uci_for_castling() -> None:
    # In a position where castling is legal, the move is accepted and returned
    # in chess.js-compatible standard UCI (king-destination form).
    fen = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4"
    result = _parse_moves(fen, "e1g1")  # white kingside castling
    assert result == ["e1g1"]


# ── LichessTactic payload ─────────────────────────────────────────────────────

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


# ── Decoy payload ─────────────────────────────────────────────────────────────

def _stub_decoy(
    *,
    training_item_id: int = 10,
    fen: str = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    opponent_move: str = "e2e4",
    accepted_moves: list | None = None,
    best_cp: int = 12,
    move_number: int = 2,
    depth: int = 20,
    analysis_url: str | None = None,
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
    d.move_number = move_number
    d.depth = depth
    d.analysis_url = analysis_url
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


def test_decoy_payload_sorts_accepted_moves_descending_for_white_player() -> None:
    # FEN has 'b' to move → opponent is black → player is white → sort descending (highest cp first).
    fen_black_to_move = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
    decoy = _stub_decoy(
        fen=fen_black_to_move,
        accepted_moves=[
            {"uci": "g8f6", "cp": 5, "line": "g8f6"},
            {"uci": "e7e5", "cp": 12, "line": "e7e5"},
            {"uci": "c7c5", "cp": 8, "line": "c7c5"},
        ],
    )
    with patch("app.services.training_item_content.db") as mock_db:
        mock_db.session.execute.return_value.scalar_one.return_value = decoy
        payload = _decoy_payload(10)
    accepted = list(payload.contract.plies[1])
    assert accepted == ["e7e5", "c7c5", "g8f6"]  # descending by cp: 12, 8, 5


def test_decoy_payload_sorts_accepted_moves_ascending_for_black_player() -> None:
    # FEN has 'w' to move → opponent is white → player is black → sort ascending (lowest cp first).
    fen_white_to_move = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    decoy = _stub_decoy(
        fen=fen_white_to_move,
        accepted_moves=[
            {"uci": "e2e4", "cp": 20, "line": "e2e4"},
            {"uci": "d2d4", "cp": -5, "line": "d2d4"},
            {"uci": "c2c4", "cp": 10, "line": "c2c4"},
        ],
    )
    with patch("app.services.training_item_content.db") as mock_db:
        mock_db.session.execute.return_value.scalar_one.return_value = decoy
        payload = _decoy_payload(10)
    accepted = list(payload.contract.plies[1])
    assert accepted == ["d2d4", "c2c4", "e2e4"]  # ascending by cp: -5, 10, 20


def test_get_content_batch_with_empty_list_returns_empty_dict() -> None:
    result = get_content_batch([])
    assert result == {}


@pytest.mark.parametrize(
    "move_number,expected_fullmove",
    [
        (20, 10),  # even ply: Black's 10th move → fullmove 10
        (21, 10),  # odd ply: White's 11th move → fullmove still 10
        (22, 11),  # even ply: Black's 11th move → fullmove 11
    ],
)
def test_decoy_payload_fullmove_number_from_four_part_fen(
    move_number: int, expected_fullmove: int
) -> None:
    # 4-part FEN (no halfmove/fullmove); the service must append them correctly.
    four_part_fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -"
    decoy = _stub_decoy(fen=four_part_fen, move_number=move_number, analysis_url="https://x")
    with patch("app.services.training_item_content.db") as mock_db:
        mock_db.session.execute.return_value.scalar_one.return_value = decoy
        payload = _decoy_payload(10)
    assert payload.contract.fen == f"{four_part_fen} 0 {expected_fullmove}"
