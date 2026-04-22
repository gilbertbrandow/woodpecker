import random
from datetime import datetime, timezone
from typing import cast

import sqlalchemy as sa
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.puzzle import Puzzle
from app.models.run import MAX_PUZZLE_TIME_MS, PuzzleAttempt, Run, RunPuzzle
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
) -> tuple[PuzzleAttempt, RunPuzzle, Run]:
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


def _total_queue_attempts(config: dict[str, object]) -> int:
    rep_raw = config.get("failed_repetition")
    if not isinstance(rep_raw, dict):
        return 1
    rep = cast(dict[str, object], rep_raw)
    if rep.get("mode") != "queue":
        return 1
    max_repeats = rep.get("max_repeats")
    return 1 + (max_repeats if isinstance(max_repeats, int) else 0)


def _derive_position_status(
    attempts: list[PuzzleAttempt], total_queue: int
) -> str:
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


def _is_puzzle_terminal(attempts: list[PuzzleAttempt], total_queue: int) -> bool:
    completed = [a for a in attempts if a.status != "in_progress"]
    if any(a.status == "solved" and a.try_number <= total_queue for a in completed):
        return True
    return sum(1 for a in completed if a.try_number <= total_queue) >= total_queue


def _all_puzzles_terminal(run_id: int, total_queue: int) -> bool:
    non_terminal = db.session.scalar(
        sa.text("""
            SELECT COUNT(*) FROM run_puzzles rp
            WHERE rp.run_id = :run_id
              AND NOT EXISTS(
                  SELECT 1 FROM puzzle_attempts pa
                  WHERE pa.run_puzzle_id = rp.id
                    AND pa.status = 'solved'
                    AND pa.try_number <= :total_queue
              )
              AND (
                  SELECT COUNT(*) FROM puzzle_attempts pa
                  WHERE pa.run_puzzle_id = rp.id
                    AND pa.status != 'in_progress'
                    AND pa.try_number <= :total_queue
              ) < :total_queue
        """),
        {"run_id": run_id, "total_queue": total_queue},
    )
    return (non_terminal or 0) == 0


def _current_run_puzzle_id(run_id: int, total_queue: int) -> int | None:
    row = db.session.execute(
        sa.text("""
            SELECT rp.id
            FROM run_puzzles rp
            WHERE rp.run_id = :run_id
              AND NOT EXISTS(
                  SELECT 1 FROM puzzle_attempts pa
                  WHERE pa.run_puzzle_id = rp.id
                    AND pa.status = 'solved'
                    AND pa.try_number <= :total_queue
              )
              AND (
                  SELECT COUNT(*) FROM puzzle_attempts pa
                  WHERE pa.run_puzzle_id = rp.id
                    AND pa.status != 'in_progress'
                    AND pa.try_number <= :total_queue
              ) < :total_queue
            ORDER BY
              CASE WHEN EXISTS(
                  SELECT 1 FROM puzzle_attempts pa
                  WHERE pa.run_puzzle_id = rp.id AND pa.status = 'in_progress'
              ) THEN 0 ELSE 1 END,
              rp.position
            LIMIT 1
        """),
        {"run_id": run_id, "total_queue": total_queue},
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
    total_queue = _total_queue_attempts(config)

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
        "positionStatus": _derive_position_status(sorted_attempts, total_queue),
        "puzzleId": puzzle.puzzle_id,
        "fen": puzzle.fen,
        "solution": puzzle.moves,
        "rating": puzzle.rating,
        "gameUrl": puzzle.game_url,
        "maxTriesPerPuzzle": total_queue,
        "currentTryNumber": current_try_number,
        "currentAttemptId": current_attempt_id,
        "tries": [_attempt_dict(a) for a in sorted_attempts],
        "totalPuzzles": total_puzzles,
        "scheduleName": schedule.name,
        "runIndex": run.run_index,
        "themes": [
            {"name": t.name, "displayName": t.display_name}
            for t in puzzle.themes
        ],
    }


def _create_attempt_for_puzzle(run_puzzle: RunPuzzle) -> PuzzleAttempt:
    db.session.execute(
        sa.select(RunPuzzle.id)
        .where(RunPuzzle.id == run_puzzle.id)
        .with_for_update()
    )

    existing_in_progress = db.session.scalar(
        sa.select(PuzzleAttempt)
        .where(
            PuzzleAttempt.run_puzzle_id == run_puzzle.id,
            PuzzleAttempt.status == "in_progress",
        )
        .order_by(PuzzleAttempt.try_number.desc())
        .limit(1)
    )
    if existing_in_progress is not None:
        return existing_in_progress

    max_try_number = db.session.scalar(
        sa.select(sa.func.max(PuzzleAttempt.try_number)).where(
            PuzzleAttempt.run_puzzle_id == run_puzzle.id
        )
    )
    next_try_number = int(max_try_number) + 1 if max_try_number is not None else 1

    attempt = PuzzleAttempt(
        run_puzzle_id=run_puzzle.id,
        try_number=next_try_number,
        status="in_progress",
        started_at=datetime.now(timezone.utc),
        moves=[],
    )
    db.session.add(attempt)

    try:
        db.session.commit()
        return attempt
    except IntegrityError:
        db.session.rollback()
        existing_after_race = db.session.scalar(
            sa.select(PuzzleAttempt)
            .where(
                PuzzleAttempt.run_puzzle_id == run_puzzle.id,
                PuzzleAttempt.status == "in_progress",
            )
            .order_by(PuzzleAttempt.try_number.desc())
            .limit(1)
        )
        if existing_after_race is not None:
            return existing_after_race
        raise


def run_dict(run: Run) -> dict[str, object]:
    _, config = _get_schedule_config(run)
    total_queue = _total_queue_attempts(config)

    run_puzzles = list(
        db.session.scalars(sa.select(RunPuzzle).where(RunPuzzle.run_id == run.id)).all()
    )

    counts: dict[str, int] = {}
    for rp in run_puzzles:
        s = _derive_position_status(rp.attempts, total_queue)
        counts[s] = counts.get(s, 0) + 1

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
        "failedCount": counts.get("failed", 0),
        "inProgressCount": counts.get("in_progress", 0) + counts.get("not_started", 0),
        "currentRunPuzzleId": _current_run_puzzle_id(run.id, total_queue),
        "targetAccuracy": run.target_accuracy,
        "targetSolveSeconds": run.target_solve_seconds,
    }


def start_run(participation_id: int, user_id: int, expected_run_index: int | None = None) -> Run:
    participation = db.session.get(ScheduleParticipation, participation_id)
    if participation is None:
        raise LookupError("Participation not found.")
    if participation.user_id != user_id:
        raise PermissionError("Access denied.")
    if participation.completed_at is not None or participation.aborted_at is not None:
        raise ValueError("Participation is already terminal.")

    active_run = db.session.scalar(
        sa.select(Run).where(
            Run.participation_id == participation_id,
            Run.completed_at.is_(None),
            Run.aborted_at.is_(None),
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
            Run.completed_at.isnot(None),
        )
    ) or 0

    if run_index >= run_count:
        raise ValueError("All run slots for this schedule are already completed.")
    if expected_run_index is not None and expected_run_index != run_index:
        raise ValueError("Run slot is no longer startable.")

    puzzle_ids: list[int] = list(
        db.session.scalars(
            sa.select(SubsetPuzzle.puzzle_id)
            .where(SubsetPuzzle.subset_id == schedule.subset_id)
            .order_by(SubsetPuzzle.position)
        ).all()
    )

    run = Run(
        participation_id=participation_id,
        run_index=run_index,
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
            }
            for idx, pid in enumerate(puzzle_ids)
        ],
    )

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
    if run.completed_at is not None or run.aborted_at is not None:
        raise ValueError("Run is not active.")

    _, config = _get_schedule_config(run)
    total_queue = _total_queue_attempts(config)

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

    next_id = _current_run_puzzle_id(run_id, total_queue)
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
    total_queue = _total_queue_attempts(config)

    rows = db.session.execute(
        sa.text("""
            SELECT rp.id AS run_puzzle_id,
                   rp.position,
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
            GROUP BY rp.id, rp.position, p.puzzle_id, p.rating
            ORDER BY rp.position
        """),
        {"run_id": run_id},
    ).all()

    rp_ids = [row.run_puzzle_id for row in rows]
    attempts_by_puzzle: dict[int, list[PuzzleAttempt]] = {rp_id: [] for rp_id in rp_ids}
    for a in db.session.scalars(
        sa.select(PuzzleAttempt).where(PuzzleAttempt.run_puzzle_id.in_(rp_ids))
    ).all():
        attempts_by_puzzle[a.run_puzzle_id].append(a)

    puzzles: list[dict[str, object]] = [
        {
            "runPuzzleId": row.run_puzzle_id,
            "position": row.position,
            "puzzleId": row.puzzle_id,
            "rating": row.rating,
            "positionStatus": _derive_position_status(
                attempts_by_puzzle[row.run_puzzle_id], total_queue
            ),
            "tryCount": int(row.try_count) if row.try_count is not None else 0,
            "timeMs": int(row.time_ms) if row.time_ms is not None else None,
        }
        for row in rows
    ]
    return {"maxTriesPerPuzzle": total_queue, "puzzles": puzzles}


def get_run_puzzle(run_id: int, run_puzzle_id: int, user_id: int) -> dict[str, object]:
    run = _get_owned_run(run_id, user_id)
    run_puzzle = db.session.get(RunPuzzle, run_puzzle_id)
    if run_puzzle is None or run_puzzle.run_id != run.id:
        raise LookupError("Run puzzle not found.")
    return _run_puzzle_full_dict(run_puzzle)


def start_puzzle(run_id: int, run_puzzle_id: int, user_id: int) -> dict[str, object]:
    run = _get_owned_run(run_id, user_id)
    if run.completed_at is not None or run.aborted_at is not None:
        raise ValueError("Run is not active.")
    run_puzzle = db.session.get(RunPuzzle, run_puzzle_id)
    if run_puzzle is None or run_puzzle.run_id != run.id:
        raise LookupError("Run puzzle not found.")

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
    if run.completed_at is not None or run.aborted_at is not None:
        raise ValueError("Run is not active.")

    _, config = _get_schedule_config(run)
    total_queue = _total_queue_attempts(config)
    is_queue_attempt = attempt.try_number <= total_queue

    now = datetime.now(timezone.utc)
    attempt.status = status
    attempt.completed_at = now
    attempt.time_spent_ms = min(
        int((now - attempt.started_at).total_seconds() * 1000), MAX_PUZZLE_TIME_MS
    )
    attempt.moves = moves

    position_status = _derive_position_status(run_puzzle.attempts, total_queue)
    position_resolved = position_status in ("solved", "solved_with_retries", "failed")

    tries_in_window = sum(
        1 for a in run_puzzle.attempts
        if a.status != "in_progress" and a.try_number <= total_queue
    )
    tries_remaining = max(0, total_queue - tries_in_window) if not position_resolved else 0

    if is_queue_attempt and position_resolved:
        db.session.flush()
        if _all_puzzles_terminal(run.id, total_queue):
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
                        participation.completed_at = now

    db.session.commit()

    next_run_puzzle_id: int | None = None
    if position_resolved and is_queue_attempt:
        next_run_puzzle_id = _current_run_puzzle_id(run.id, total_queue)

    return {
        "positionResolved": position_resolved,
        "triesRemaining": tries_remaining,
        "markedForRetry": False,
        "nextRunPuzzleId": next_run_puzzle_id,
    }


def get_puzzle_history(run_id: int, puzzle_id: str, user_id: int) -> dict[str, object]:
    run = _get_owned_run(run_id, user_id)

    puzzle = db.session.scalar(sa.select(Puzzle).where(Puzzle.puzzle_id == puzzle_id))
    if puzzle is None:
        raise LookupError("Puzzle not found in this run.")

    _, config = _get_schedule_config(run)
    total_queue = _total_queue_attempts(config)

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
            "positionStatus": _derive_position_status(rp.attempts, total_queue),
            "tries": [
                _attempt_dict(a) for a in sorted(completed, key=lambda a: a.try_number)
            ],
        })

    return {
        "puzzleId": puzzle_id,
        "solution": puzzle.moves,
        "maxTriesPerPuzzle": total_queue,
        "positions": positions,
    }


def abort_run(run_id: int, user_id: int) -> Run:
    run = _get_owned_run(run_id, user_id)
    if run.completed_at is not None or run.aborted_at is not None:
        raise ValueError("Run is already terminal.")
    run.aborted_at = datetime.now(timezone.utc)
    db.session.commit()
    return run
