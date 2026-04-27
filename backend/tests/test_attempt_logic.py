import chess as python_chess
from app.models.run import PuzzleAttempt
from app.services.run import _derive_attempt_outcome, _derive_position_status

STANDARD_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
TWO_PLY_SOLUTION = "e2e4 d7d5"
FOUR_PLY_SOLUTION = "e2e4 d7d5 e4d5 d8d5"


def _make_attempt(try_number: int, status: str) -> PuzzleAttempt:
    a = PuzzleAttempt()
    a.try_number = try_number
    a.status = status
    return a


def test_outcome_solved_single_move() -> None:
    result = _derive_attempt_outcome(STANDARD_FEN, TWO_PLY_SOLUTION, ["d7d5"])
    assert result == "solved"


def test_outcome_solved_multi_move() -> None:
    result = _derive_attempt_outcome(STANDARD_FEN, FOUR_PLY_SOLUTION, ["d7d5", "d8d5"])
    assert result == "solved"


def test_outcome_failed_wrong_move() -> None:
    result = _derive_attempt_outcome(STANDARD_FEN, TWO_PLY_SOLUTION, ["d7d6"])
    assert result == "failed"


def test_outcome_failed_empty_moves() -> None:
    result = _derive_attempt_outcome(STANDARD_FEN, TWO_PLY_SOLUTION, [])
    assert result == "failed"


def test_outcome_solved_by_checkmate() -> None:
    fen = "4k3/Q6R/8/8/3K4/8/8/8 b - - 0 1"

    board_after_opp = python_chess.Board(fen)
    board_after_opp.push_uci("e8d8")
    for mate_uci in ("a7a8", "a7b8", "a7d7", "h7h8"):
        b = board_after_opp.copy()
        b.push_uci(mate_uci)
        assert b.is_checkmate(), f"{mate_uci} should be checkmate"
        result = _derive_attempt_outcome(fen, "e8d8 a7a8", [mate_uci])
        assert result == "solved"


def test_outcome_failed_not_all_moves() -> None:
    result = _derive_attempt_outcome(STANDARD_FEN, FOUR_PLY_SOLUTION, ["d7d5"])
    assert result == "failed"


def test_status_not_started() -> None:
    assert _derive_position_status([], 1) == "not_started"


def test_status_in_progress() -> None:
    assert _derive_position_status([_make_attempt(1, "in_progress")], 1) == "in_progress"


def test_status_solved_first_try() -> None:
    assert _derive_position_status([_make_attempt(1, "solved")], 1) == "solved"


def test_status_solved_with_retries() -> None:
    attempts = [_make_attempt(1, "failed"), _make_attempt(2, "solved")]
    assert _derive_position_status(attempts, 2) == "solved_with_retries"


def test_status_failed_queue_exhausted() -> None:
    attempts = [_make_attempt(1, "failed"), _make_attempt(2, "failed")]
    assert _derive_position_status(attempts, 2) == "failed"


def test_status_in_progress_when_queue_not_exhausted() -> None:
    assert _derive_position_status([_make_attempt(1, "failed")], 2) == "in_progress"


def test_status_solved_ignores_practice_attempts() -> None:
    # try_number=1 is solved (within queue=2) → "solved", even though later attempts exist
    attempts = [
        _make_attempt(1, "solved"),
        _make_attempt(2, "failed"),
        _make_attempt(3, "failed"),
    ]
    assert _derive_position_status(attempts, 2) == "solved"
