from app.services.chess_board import build_pgn, compute_attempt_board
from app.services.solve_contract import SolveContract

STANDARD_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
TWO_PLY = SolveContract(fen=STANDARD_FEN, plies=["e2e4", "d7d5"])
FOUR_PLY = SolveContract(fen=STANDARD_FEN, plies=["e2e4", "d7d5", "e4d5", "d8d5"])


def test_board_returns_none_for_in_progress() -> None:
    assert compute_attempt_board(TWO_PLY, "in_progress", []) is None


def test_board_solved_has_correct_result() -> None:
    result = compute_attempt_board(TWO_PLY, "solved", [["d7d5"]])
    assert result is not None
    assert result["result"] == "correct"
    assert result["terminalFen"] is not None
    assert result["lastMove"] == ["d7", "d5"]


def test_board_failed_wrong_move_has_wrong_result() -> None:
    result = compute_attempt_board(TWO_PLY, "failed", [["d7d6"]])
    assert result is not None
    assert result["result"] == "wrong"
    assert result["lastMove"] == ["d7", "d6"]


def test_board_failed_no_moves_returns_null_fields() -> None:
    result = compute_attempt_board(TWO_PLY, "failed", [])
    assert result is not None
    assert result["terminalFen"] is None
    assert result["lastMove"] is None
    assert result["result"] is None


def test_pgn_solved_mainline_contains_moves() -> None:
    result = build_pgn(TWO_PLY, [["d7d5"]])
    assert result is not None
    mainline = result["mainline"]
    assert isinstance(mainline, list)
    assert len(mainline) >= 2
    assert result["subvariations"] is None


def test_pgn_solved_move_statuses() -> None:
    result = build_pgn(TWO_PLY, [["d7d5"]])
    assert result is not None
    mainline = result["mainline"]
    assert isinstance(mainline, list)
    assert mainline[0]["moveStatus"] == "opponent"
    assert mainline[1]["moveStatus"] == "correct"


def test_pgn_failed_wrong_move_produces_subvariation() -> None:
    result = build_pgn(TWO_PLY, [["d7d6"]])
    assert result is not None
    subvariations = result["subvariations"]
    assert isinstance(subvariations, list)
    assert len(subvariations) == 1
    assert isinstance(subvariations[0][0], dict)
    assert subvariations[0][0]["moveStatus"] == "wrong"
    mainline = result["mainline"]
    assert isinstance(mainline, list)
    # Mainline should be the correct solution (no wrong moves in mainline)
    assert all(m["moveStatus"] != "wrong" for m in mainline)


def test_pgn_multi_move_solution_solved() -> None:
    result = build_pgn(FOUR_PLY, [["d7d5", "d8d5"]])
    assert result is not None
    assert result["subvariations"] is None
    mainline = result["mainline"]
    assert isinstance(mainline, list)
    correct_moves = [m for m in mainline if m["moveStatus"] == "correct"]
    assert len(correct_moves) == 2


def test_pgn_multiple_failed_variations() -> None:
    result = build_pgn(FOUR_PLY, [["d7d6"], ["d7d5", "d8d4"]])
    assert result is not None
    subvariations = result["subvariations"]
    assert isinstance(subvariations, list)
    assert len(subvariations) == 2
    assert all(isinstance(sv[0], dict) and sv[0]["moveStatus"] == "wrong" for sv in subvariations)


def test_pgn_empty_moves_no_subvariations() -> None:
    result = build_pgn(TWO_PLY, [])
    assert result is not None
    assert result["subvariations"] is None
