import random
from datetime import datetime, timezone

import sqlalchemy as sa

from app.extensions import db
from app.models.puzzle import Puzzle
from app.models.run import (
    MAX_PUZZLE_TIME_MS,
    POSITION_FIRST_PASS_DONE,
    POSITION_TERMINAL_STATUSES,
    PuzzleAttempt,
    Run,
    RunPuzzle,
)
from app.models.schedule import Schedule
from app.models.schedule_participation import ScheduleParticipation
from app.models.subset import SubsetPuzzle


def _get_owned_run(run_id: int, user_id: int) -> Run:
    run = db.session.get(Run, run_id)
    if run is None:
        raise LookupError("Run not found.")
    participation = db.session.get(ScheduleParticipation, run.participation_id)
    if participation is None or participation.user_id != user_id:
        raise PermissionError("Access denied.")
    return run


def _get_owned_attempt(
    attempt_id: int, user_id: int
) -> tuple["PuzzleAttempt", "RunPuzzle", "Run"]:
    attempt = db.session.get(PuzzleAttempt, attempt_id)
    if attempt is None:
        raise LookupError("Attempt not found.")
    run_puzzle = db.session.get(RunPuzzle, attempt.run_puzzle_id)
    if run_puzzle is None:
        raise LookupError("Run puzzle not found.")
    run = _get_owned_run(run_puzzle.run_id, user_id)
    return attempt, run_puzzle, run


def _get_schedule_config(run: Run) -> tuple[Schedule, dict[str, object]]:
    participation = db.session.get(ScheduleParticipation, run.participation_id)
    if participation is None:
        raise LookupError("Participation not found.")
    schedule = db.session.get(Schedule, participation.schedule_id)
    if schedule is None:
        raise LookupError("Schedule not found.")
    config: dict[str, object] = schedule.config if isinstance(schedule.config, dict) else {}
    return schedule, config


def _current_run_puzzle_id(run_id: int) -> int | None:
    row = db.session.execute(
        sa.text("""
            SELECT id
            FROM run_puzzles
            WHERE run_id = :run_id
              AND status NOT IN ('solved', 'solved_with_retries', 'failed')
            ORDER BY
              CASE WHEN status IN ('not_started', 'in_progress') THEN 0 ELSE 1 END,
              position
            LIMIT 1
        """),
        {"run_id": run_id},
    ).first()
    if row is None:
        return None
    return int(row.id)


def _attempt_dict(attempt: PuzzleAttempt) -> dict[str, object]:
    return {
        "id": attempt.id,
        "tryNumber": attempt.try_number,
        "status": attempt.status,
        "startedAt": attempt.started_at.isoformat(),
        "completedAt": attempt.completed_at.isoformat() if attempt.completed_at else None,
        "timeSpentMs": attempt.time_spent_ms,
        "moves": attempt.moves if isinstance(attempt.moves, list) else [],
    }


def _run_puzzle_full_dict(run_puzzle: RunPuzzle) -> dict[str, object]:
    puzzle = db.session.get(Puzzle, run_puzzle.puzzle_id)
    if puzzle is None:
        raise LookupError("Puzzle not found.")
    run = db.session.get(Run, run_puzzle.run_id)
    if run is None:
        raise LookupError("Run not found.")
    schedule, config = _get_schedule_config(run)
    max_tries_raw = config.get("max_tries_per_puzzle")
    max_tries = max_tries_raw if isinstance(max_tries_raw, int) else 1

    total_puzzles = db.session.scalar(
        sa.select(sa.func.count()).where(RunPuzzle.run_id == run_puzzle.run_id)
    ) or 0

    sorted_attempts = sorted(run_puzzle.attempts, key=lambda a: a.try_number)
    in_progress_attempt = next((a for a in sorted_attempts if a.status == "in_progress"), None)

    if in_progress_attempt is not None:
        current_try_number: int = in_progress_attempt.try_number
        current_attempt_id: int | None = in_progress_attempt.id
    elif sorted_attempts:
        current_try_number = sorted_attempts[-1].try_number
        current_attempt_id = None
    else:
        current_try_number = 1
        current_attempt_id = None

    return {
        "runPuzzleId": run_puzzle.id,
        "position": run_puzzle.position,
        "positionStatus": run_puzzle.status,
        "puzzleId": puzzle.puzzle_id,
        "fen": puzzle.fen,
        "solution": puzzle.moves,
        "rating": puzzle.rating,
        "gameUrl": puzzle.game_url,
        "maxTriesPerPuzzle": max_tries,
        "currentTryNumber": current_try_number,
        "currentAttemptId": current_attempt_id,
        "tries": [_attempt_dict(a) for a in sorted_attempts],
        "totalPuzzles": total_puzzles,
        "scheduleName": schedule.name,
        "runIndex": run.run_index,
    }


def _create_attempt_for_puzzle(run_puzzle: RunPuzzle) -> PuzzleAttempt:
    existing_count = db.session.scalar(
        sa.select(sa.func.count()).where(
            PuzzleAttempt.run_puzzle_id == run_puzzle.id,
        )
    ) or 0
    attempt = PuzzleAttempt(
        run_puzzle_id=run_puzzle.id,
        try_number=existing_count + 1,
        status="in_progress",
        started_at=datetime.now(timezone.utc),
        moves=[],
    )
    db.session.add(attempt)
    db.session.commit()
    return attempt


def run_dict(run: Run) -> dict[str, object]:
    counts: dict[str, int] = {}
    rows = db.session.execute(
        sa.text(
            "SELECT status, COUNT(*) AS cnt FROM run_puzzles WHERE run_id = :rid GROUP BY status"
        ),
        {"rid": run.id},
    ).all()
    for row in rows:
        counts[str(row.status)] = int(row.cnt)

    total = sum(counts.values())
    return {
        "id": run.id,
        "participationId": run.participation_id,
        "runIndex": run.run_index,
        "status": run.status,
        "startedAt": run.started_at.isoformat(),
        "completedAt": run.completed_at.isoformat() if run.completed_at else None,
        "abortedAt": run.aborted_at.isoformat() if run.aborted_at else None,
        "totalPuzzles": total,
        "solvedCount": counts.get("solved", 0),
        "solvedWithRetriesCount": counts.get("solved_with_retries", 0),
        "willBeRetriedCount": counts.get("will_be_retried", 0),
        "failedCount": counts.get("failed", 0),
        "inProgressCount": counts.get("in_progress", 0) + counts.get("not_started", 0),
        "currentRunPuzzleId": _current_run_puzzle_id(run.id),
    }


def start_run(participation_id: int, user_id: int, expected_run_index: int | None = None) -> Run:
    participation = db.session.get(ScheduleParticipation, participation_id)
    if participation is None:
        raise LookupError("Participation not found.")
    if participation.user_id != user_id:
        raise PermissionError("Access denied.")
    if participation.status in ("aborted", "completed"):
        raise ValueError("Participation is already terminal.")

    active_run = db.session.scalar(
        sa.select(Run).where(
            Run.participation_id == participation_id,
            Run.status == "active",
        )
    )
    if active_run is not None:
        raise ValueError("An active run already exists for this participation.")

    schedule = db.session.get(Schedule, participation.schedule_id)
    if schedule is None:
        raise LookupError("Schedule not found.")
    config: dict[str, object] = schedule.config if isinstance(schedule.config, dict) else {}
    runs_raw = config.get("runs")
    run_count = len(runs_raw) if isinstance(runs_raw, list) else 0
    puzzle_order_raw = config.get("puzzle_order")
    puzzle_order = puzzle_order_raw if isinstance(puzzle_order_raw, str) else "sequential"

    run_index = db.session.scalar(
        sa.select(sa.func.count()).where(
            Run.participation_id == participation_id,
            Run.status == "completed",
        )
    ) or 0

    if run_index >= run_count:
        raise ValueError("All run slots for this schedule are already completed.")
    if expected_run_index is not None and expected_run_index != run_index:
        raise ValueError("Run slot is no longer startable.")

    puzzle_ids: list[int] = list(
        db.session.scalars(
            sa.select(SubsetPuzzle.puzzle_id)
            .where(
                SubsetPuzzle.subset_id == schedule.subset_id,
                SubsetPuzzle.is_discarded == False,  # noqa: E712
            )
            .order_by(SubsetPuzzle.position)
        ).all()
    )

    run = Run(
        participation_id=participation_id,
        run_index=run_index,
        status="active",
    )
    db.session.add(run)
    db.session.flush()

    if puzzle_order == "random":
        rng = random.Random(run.id)
        puzzle_ids = sorted(puzzle_ids, key=lambda _: rng.random())

    db.session.execute(
        sa.insert(RunPuzzle),
        [
            {
                "run_id": run.id,
                "position": idx,
                "puzzle_id": pid,
                "status": "not_started",
            }
            for idx, pid in enumerate(puzzle_ids)
        ],
    )

    if participation.status == "draft":
        participation.status = "in_progress"

    db.session.commit()
    return run


def list_runs(participation_id: int, user_id: int) -> list[Run]:
    participation = db.session.get(ScheduleParticipation, participation_id)
    if participation is None:
        raise LookupError("Participation not found.")
    if participation.user_id != user_id:
        raise PermissionError("Access denied.")
    return list(
        db.session.scalars(
            sa.select(Run)
            .where(Run.participation_id == participation_id)
            .order_by(Run.started_at.asc())
        ).all()
    )


def get_run(run_id: int, user_id: int) -> Run:
    return _get_owned_run(run_id, user_id)


def continue_run(run_id: int, user_id: int) -> dict[str, object]:
    run = _get_owned_run(run_id, user_id)
    if run.status != "active":
        raise ValueError("Run is not active.")

    existing_attempt = db.session.scalar(
        sa.select(PuzzleAttempt)
        .join(RunPuzzle, PuzzleAttempt.run_puzzle_id == RunPuzzle.id)
        .where(
            RunPuzzle.run_id == run_id,
            PuzzleAttempt.status == "in_progress",
        )
    )
    if existing_attempt is not None:
        run_puzzle = db.session.get(RunPuzzle, existing_attempt.run_puzzle_id)
        if run_puzzle is None:
            raise LookupError("Run puzzle not found.")
        return _run_puzzle_full_dict(run_puzzle)

    next_id = _current_run_puzzle_id(run_id)
    if next_id is None:
        raise ValueError("Run is already complete.")

    run_puzzle = db.session.get(RunPuzzle, next_id)
    if run_puzzle is None:
        raise LookupError("Run puzzle not found.")
    _create_attempt_for_puzzle(run_puzzle)
    db.session.refresh(run_puzzle)
    return _run_puzzle_full_dict(run_puzzle)


def list_run_puzzles(run_id: int, user_id: int) -> dict[str, object]:
    run = _get_owned_run(run_id, user_id)
    _, config = _get_schedule_config(run)
    max_tries_raw = config.get("max_tries_per_puzzle")
    max_tries = max_tries_raw if isinstance(max_tries_raw, int) else 1

    rows = db.session.execute(
        sa.text("""
            SELECT rp.id AS run_puzzle_id,
                   rp.position,
                   rp.status AS position_status,
                   p.puzzle_id,
                   p.rating,
                   COUNT(pa.id) FILTER (WHERE pa.status != 'in_progress') AS try_count,
                   (
                       SELECT pa2.time_spent_ms
                       FROM puzzle_attempts pa2
                       WHERE pa2.run_puzzle_id = rp.id
                         AND pa2.status != 'in_progress'
                       ORDER BY pa2.try_number DESC
                       LIMIT 1
                   ) AS time_ms
            FROM run_puzzles rp
            JOIN puzzles p ON p.id = rp.puzzle_id
            LEFT JOIN puzzle_attempts pa ON pa.run_puzzle_id = rp.id
            WHERE rp.run_id = :run_id
            GROUP BY rp.id, rp.position, rp.status, p.puzzle_id, p.rating
            ORDER BY rp.position
        """),
        {"run_id": run_id},
    ).all()

    puzzles: list[dict[str, object]] = [
        {
            "runPuzzleId": row.run_puzzle_id,
            "position": row.position,
            "puzzleId": row.puzzle_id,
            "rating": row.rating,
            "positionStatus": row.position_status,
            "tryCount": int(row.try_count) if row.try_count is not None else 0,
            "timeMs": int(row.time_ms) if row.time_ms is not None else None,
        }
        for row in rows
    ]
    return {"maxTriesPerPuzzle": max_tries, "puzzles": puzzles}


def get_run_puzzle(run_id: int, run_puzzle_id: int, user_id: int) -> dict[str, object]:
    run = _get_owned_run(run_id, user_id)
    run_puzzle = db.session.get(RunPuzzle, run_puzzle_id)
    if run_puzzle is None or run_puzzle.run_id != run.id:
        raise LookupError("Run puzzle not found.")
    return _run_puzzle_full_dict(run_puzzle)


def start_puzzle(run_id: int, run_puzzle_id: int, user_id: int) -> dict[str, object]:
    run = _get_owned_run(run_id, user_id)
    if run.status != "active":
        raise ValueError("Run is not active.")
    run_puzzle = db.session.get(RunPuzzle, run_puzzle_id)
    if run_puzzle is None or run_puzzle.run_id != run.id:
        raise LookupError("Run puzzle not found.")
    if run_puzzle.status in POSITION_TERMINAL_STATUSES:
        raise ValueError("Position is already resolved.")

    existing = db.session.scalar(
        sa.select(PuzzleAttempt).where(
            PuzzleAttempt.run_puzzle_id == run_puzzle_id,
            PuzzleAttempt.status == "in_progress",
        )
    )
    if existing is None:
        _create_attempt_for_puzzle(run_puzzle)
        db.session.refresh(run_puzzle)

    return _run_puzzle_full_dict(run_puzzle)


def submit_moves(attempt_id: int, user_id: int, moves: list[str]) -> None:
    attempt, _, _ = _get_owned_attempt(attempt_id, user_id)
    if attempt.status != "in_progress":
        raise ValueError("Attempt is already completed.")
    current = attempt.moves if isinstance(attempt.moves, list) else []
    attempt.moves = [*current, *moves]
    db.session.commit()


def complete_attempt(
    attempt_id: int,
    user_id: int,
    status: str,
    moves: list[str],
) -> dict[str, object]:
    attempt, run_puzzle, run = _get_owned_attempt(attempt_id, user_id)

    if attempt.status != "in_progress":
        raise ValueError("Attempt is already completed.")
    if run.status != "active":
        raise ValueError("Run is not active.")

    _, config = _get_schedule_config(run)
    retry_failed_raw = config.get("retry_failed")
    retry_failed = retry_failed_raw if isinstance(retry_failed_raw, bool) else False
    max_tries_raw = config.get("max_tries_per_puzzle")
    max_tries = max_tries_raw if isinstance(max_tries_raw, int) else 1

    rp_status = run_puzzle.status
    if rp_status in POSITION_TERMINAL_STATUSES:
        raise ValueError("Position is already resolved.")

    rp_position = run_puzzle.position

    if rp_status in ("not_started", "in_progress"):
        out_of_order = db.session.scalar(
            sa.select(sa.func.count()).where(
                RunPuzzle.run_id == run.id,
                RunPuzzle.position < rp_position,
                RunPuzzle.status.notin_(list(POSITION_FIRST_PASS_DONE)),
            )
        ) or 0
        if out_of_order > 0:
            raise ValueError("Prior position not yet resolved.")
    elif rp_status == "will_be_retried":
        first_pass_remaining = db.session.scalar(
            sa.select(sa.func.count()).where(
                RunPuzzle.run_id == run.id,
                RunPuzzle.status.in_(["not_started", "in_progress"]),
            )
        ) or 0
        if first_pass_remaining > 0:
            raise ValueError("First pass is not yet complete.")
        retry_out_of_order = db.session.scalar(
            sa.select(sa.func.count()).where(
                RunPuzzle.run_id == run.id,
                RunPuzzle.position < rp_position,
                RunPuzzle.status == "will_be_retried",
            )
        ) or 0
        if retry_out_of_order > 0:
            raise ValueError("Prior retry position not yet resolved.")

    try_number = attempt.try_number
    is_retry_pass = try_number > max_tries
    if is_retry_pass:
        tries_in_pass = try_number - max_tries
        pass_exhausted = tries_in_pass >= max_tries
    else:
        pass_exhausted = try_number >= max_tries

    now = datetime.now(timezone.utc)
    delta_ms = int((now - attempt.started_at).total_seconds() * 1000)
    time_spent_ms = min(delta_ms, MAX_PUZZLE_TIME_MS)

    attempt.status = status
    attempt.completed_at = now
    attempt.time_spent_ms = time_spent_ms
    attempt.moves = moves

    resolved_as_solved = status == "solved"
    resolved_as_failed = status == "failed" and pass_exhausted

    if resolved_as_solved:
        if try_number == 1 and not is_retry_pass:
            run_puzzle.status = "solved"
        else:
            run_puzzle.status = "solved_with_retries"
    elif resolved_as_failed:
        if retry_failed and not is_retry_pass:
            run_puzzle.status = "will_be_retried"
        else:
            run_puzzle.status = "failed"
    else:
        run_puzzle.status = "in_progress"

    position_resolved = run_puzzle.status in POSITION_TERMINAL_STATUSES
    marked_for_retry = run_puzzle.status == "will_be_retried"

    if pass_exhausted or resolved_as_solved:
        tries_remaining = 0
    elif is_retry_pass:
        tries_remaining = max_tries - (try_number - max_tries)
    else:
        tries_remaining = max_tries - try_number

    all_unresolved = db.session.scalar(
        sa.select(sa.func.count()).where(
            RunPuzzle.run_id == run.id,
            RunPuzzle.status.notin_(list(POSITION_TERMINAL_STATUSES)),
        )
    ) or 0

    if all_unresolved == 0:
        run.status = "completed"
        run.completed_at = now
        participation = db.session.get(ScheduleParticipation, run.participation_id)
        if participation is not None:
            schedule = db.session.get(Schedule, participation.schedule_id)
            if schedule is not None:
                schedule_config: dict[str, object] = (
                    schedule.config if isinstance(schedule.config, dict) else {}
                )
                runs_list = schedule_config.get("runs")
                run_count = len(runs_list) if isinstance(runs_list, list) else 0
                if run.run_index == run_count - 1:
                    participation.status = "completed"
                    participation.completed_at = now

    db.session.commit()

    next_run_puzzle_id: int | None = None
    if position_resolved:
        next_run_puzzle_id = _current_run_puzzle_id(run.id)

    return {
        "positionResolved": position_resolved,
        "triesRemaining": tries_remaining,
        "markedForRetry": marked_for_retry,
        "nextRunPuzzleId": next_run_puzzle_id,
    }


def get_puzzle_history(run_id: int, puzzle_id: str, user_id: int) -> dict[str, object]:
    run = _get_owned_run(run_id, user_id)

    puzzle = db.session.scalar(sa.select(Puzzle).where(Puzzle.puzzle_id == puzzle_id))
    if puzzle is None:
        raise LookupError("Puzzle not found in this run.")

    _, config = _get_schedule_config(run)
    max_tries_raw = config.get("max_tries_per_puzzle")
    max_tries = max_tries_raw if isinstance(max_tries_raw, int) else 1

    run_puzzles = list(
        db.session.scalars(
            sa.select(RunPuzzle)
            .where(
                RunPuzzle.run_id == run_id,
                RunPuzzle.puzzle_id == puzzle.id,
            )
            .order_by(RunPuzzle.position)
        ).all()
    )
    if not run_puzzles:
        raise LookupError("Puzzle not found in this run.")

    positions: list[dict[str, object]] = []
    for rp in run_puzzles:
        completed = [a for a in rp.attempts if a.status != "in_progress"]
        if not completed:
            continue
        positions.append({
            "position": rp.position,
            "positionStatus": rp.status,
            "tries": [
                _attempt_dict(a) for a in sorted(completed, key=lambda a: a.try_number)
            ],
        })

    return {
        "puzzleId": puzzle_id,
        "solution": puzzle.moves,
        "maxTriesPerPuzzle": max_tries,
        "positions": positions,
    }


def abort_run(run_id: int, user_id: int) -> Run:
    run = _get_owned_run(run_id, user_id)
    if run.status in ("completed", "aborted"):
        raise ValueError("Run is already terminal.")
    run.status = "aborted"
    run.aborted_at = datetime.now(timezone.utc)
    db.session.commit()
    return run
