from typing import cast

import chess

from app.models.run import TrainingAttempt


def derive_position_status(attempts: list[TrainingAttempt], total_queue: int) -> str:
    if not attempts:
        return "not_started"
    if any(a.status == "in_progress" for a in attempts):
        return "in_progress"
    completed = sorted(
        [a for a in attempts if a.status != "in_progress"],
        key=lambda a: a.try_number,
    )
    for a in completed:
        if a.status == "solved" and a.try_number <= total_queue:
            return "solved" if a.try_number == 1 else "solved_with_retries"
    queue_done = sum(1 for a in completed if a.try_number <= total_queue)
    if queue_done >= total_queue:
        return "failed"
    return "in_progress"


def is_puzzle_terminal(attempts: list[TrainingAttempt], total_queue: int) -> bool:
    completed = [a for a in attempts if a.status != "in_progress"]
    if any(a.status == "solved" and a.try_number <= total_queue for a in completed):
        return True
    return sum(1 for a in completed if a.try_number <= total_queue) >= total_queue


def attempt_type_fields(
    sorted_attempts: list[TrainingAttempt],
    current_try_number: int,
    total_queue: int,
) -> dict[str, object]:
    is_beyond_queue = current_try_number > total_queue
    already_solved_in_queue = any(
        a.status == "solved" and a.try_number < current_try_number
        for a in sorted_attempts
        if a.status != "in_progress"
    )
    is_practice = is_beyond_queue or already_solved_in_queue
    counts_towards = not is_practice
    return {
        "attemptType": "practice" if is_practice else "scored",
        "countsTowardsTraining": counts_towards,
        "countsTowardsProgress": counts_towards,
        "countsTowardsAccuracy": counts_towards,
        "countsTowardsAverageTime": counts_towards,
    }


def qualifying_attempt_id(
    sorted_attempts: list[TrainingAttempt], total_queue: int
) -> int | None:
    for a in sorted_attempts:
        if a.status == "solved" and a.try_number <= total_queue:
            return a.id
    completed_in_window = [
        a for a in sorted_attempts
        if a.status != "in_progress" and a.try_number <= total_queue
    ]
    if len(completed_in_window) >= total_queue:
        return completed_in_window[-1].id
    return None


def derive_attempt_outcome(fen: str, solution: str, uci_moves: list[str]) -> str:
    solution_plies = solution.split()
    player_positions = list(range(1, len(solution_plies), 2))
    required_player_count = len(player_positions)

    if not solution_plies or required_player_count == 0:
        return "failed"

    board = chess.Board(fen)
    try:
        board.push_uci(solution_plies[0])
        for i, player_uci in enumerate(uci_moves):
            if i >= required_player_count:
                return "failed"
            move = chess.Move.from_uci(player_uci)
            if not board.is_legal(move):
                return "failed"
            board.push(move)
            expected_uci = solution_plies[player_positions[i]]
            if player_uci != expected_uci and not board.is_checkmate():
                return "failed"
            if i < required_player_count - 1:
                board.push_uci(solution_plies[player_positions[i] + 1])
    except (chess.InvalidMoveError, chess.IllegalMoveError, ValueError, IndexError):
        return "failed"

    return "solved" if len(uci_moves) == required_player_count else "failed"
