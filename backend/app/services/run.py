import math
import random
from datetime import datetime, timezone
from typing import cast

import sqlalchemy as sa
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.run import MAX_PUZZLE_TIME_MS, TrainingAttempt, Run, RunTrainingItem
from app.models.schedule import Schedule
from app.models.training import Training
from app.models.subset import Subset, SubsetTrainingItem
from app.services.attempt_state import (
    attempt_type_fields,
    derive_attempt_outcome,
    derive_position_status,
    is_puzzle_terminal,
    qualifying_attempt_id,
)
from app.services.chess_board import compute_attempt_board, compute_attempt_pgn
from app.services.schedule_config import ScheduleConfig
from app.services.training_item_content import TrainingItemContent, get_content, get_content_batch


def _get_run(run_id: int) -> Run:
    run = db.session.get(Run, run_id)
    if run is None:
        raise LookupError("Run not found.")
    return run


def _get_owned_run(run_id: int, user_id: int) -> Run:
    run = _get_run(run_id)
    training = db.session.get(Training, run.training_id)
    if training is None or training.user_id != user_id:
        raise PermissionError("Access denied.")
    return run


def _get_owned_attempt(
    attempt_id: int, user_id: int
) -> tuple[TrainingAttempt, RunTrainingItem, Run]:
    attempt = db.session.get(TrainingAttempt, attempt_id)
    if attempt is None:
        raise LookupError("Attempt not found.")
    run_puzzle = db.session.get(RunTrainingItem, attempt.run_training_item_id)
    if run_puzzle is None:
        raise LookupError("Run puzzle not found.")
    run = _get_owned_run(run_puzzle.run_id, user_id)
    return attempt, run_puzzle, run


def _get_schedule_config(run: Run) -> tuple[Schedule, ScheduleConfig]:
    training = db.session.get(Training, run.training_id)
    if training is None:
        raise LookupError("Training not found.")
    schedule = db.session.get(Schedule, training.schedule_id)
    if schedule is None:
        raise LookupError("Schedule not found.")
    if not isinstance(schedule.config, dict):
        raise LookupError("Schedule has no config.")
    return schedule, ScheduleConfig.from_dict(schedule.config)


def _format_break_duration(hours: int) -> str | None:
    if hours <= 0:
        return None
    if hours < 24:
        return f"{hours} hour{'s' if hours != 1 else ''}"
    days = hours // 24
    if days < 7:
        return f"{days} day{'s' if days != 1 else ''}"
    weeks = days // 7
    return f"{weeks} week{'s' if weeks != 1 else ''}"




def _all_puzzles_terminal(run_id: int, total_queue: int) -> bool:
    non_terminal = db.session.scalar(
        sa.text("""
            SELECT COUNT(*) FROM run_training_items rp
            WHERE rp.run_id = :run_id
              AND NOT EXISTS(
                  SELECT 1 FROM training_attempts pa
                  WHERE pa.run_training_item_id = rp.id
                    AND pa.status = 'solved'
                    AND pa.try_number <= :total_queue
              )
              AND (
                  SELECT COUNT(*) FROM training_attempts pa
                  WHERE pa.run_training_item_id = rp.id
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
            FROM run_training_items rp
            WHERE rp.run_id = :run_id
              AND NOT EXISTS(
                  SELECT 1 FROM training_attempts pa
                  WHERE pa.run_training_item_id = rp.id
                    AND pa.status = 'solved'
                    AND pa.try_number <= :total_queue
              )
              AND (
                  SELECT COUNT(*) FROM training_attempts pa
                  WHERE pa.run_training_item_id = rp.id
                    AND pa.status != 'in_progress'
                    AND pa.try_number <= :total_queue
              ) < :total_queue
            ORDER BY
              CASE WHEN EXISTS(
                  SELECT 1 FROM training_attempts pa
                  WHERE pa.run_training_item_id = rp.id AND pa.status = 'in_progress'
              ) THEN 0 ELSE 1 END,
              CASE WHEN NOT EXISTS(
                  SELECT 1 FROM training_attempts pa
                  WHERE pa.run_training_item_id = rp.id
              ) THEN 0 ELSE 1 END,
              rp.position
            LIMIT 1
        """),
        {"run_id": run_id, "total_queue": total_queue},
    ).first()
    if row is None:
        return None
    return int(row.id)


def _attempt_dict(attempt: TrainingAttempt) -> dict[str, object]:
    return {
        "id": attempt.id,
        "tryNumber": attempt.try_number,
        "status": attempt.status,
        "startedAt": attempt.started_at.isoformat(),
        "completedAt": attempt.completed_at.isoformat() if attempt.completed_at else None,
        "timeSpentMs": attempt.time_spent_ms,
        "moves": attempt.moves if isinstance(attempt.moves, list) else [],
    }



def _session_attempt_strip_item(
    attempt: TrainingAttempt, total_queue: int
) -> dict[str, object]:
    sorted_for_type = [attempt]
    type_data = attempt_type_fields(sorted_for_type, attempt.try_number, total_queue)
    return {
        "id": attempt.id,
        "tryNumber": attempt.try_number,
        "status": attempt.status,
        "attemptType": type_data["attemptType"],
    }


def _run_puzzle_attempt_view_dict(run_puzzle: RunTrainingItem) -> dict[str, object]:
    content = get_content(run_puzzle.training_item_id)
    run = db.session.get(Run, run_puzzle.run_id)
    if run is None:
        raise LookupError("Run not found.")
    _, config = _get_schedule_config(run)
    total_queue = config.total_queue

    sorted_attempts = sorted(run_puzzle.attempts, key=lambda a: a.try_number)
    in_progress_attempt = next((a for a in sorted_attempts if a.status == "in_progress"), None)
    if in_progress_attempt is None:
        raise LookupError("No in-progress attempt found.")

    training = db.session.get(Training, run.training_id)
    schedule = db.session.get(Schedule, training.schedule_id) if training else None
    schedule_name: str | None = schedule.name if schedule is not None else None

    position_status = derive_position_status(sorted_attempts, total_queue)
    position_resolved = position_status in ("solved", "solved_with_retries", "failed")
    tries_in_window = sum(
        1 for a in sorted_attempts
        if a.status != "in_progress" and a.try_number <= total_queue
    )
    tries_remaining = max(0, total_queue - tries_in_window) if not position_resolved else 0

    attempt_type_data = attempt_type_fields(
        sorted_attempts, in_progress_attempt.try_number, total_queue
    )

    target_solve_tenths: int | None = (
        run.target_solve_seconds * 10 if run.target_solve_seconds is not None else None
    )

    return {
        "runTrainingItem": {
            "id": run_puzzle.id,
            "trainingItemId": run_puzzle.training_item_id,
            "runId": run.id,
            "runIndex": run.run_index,
            "position": run_puzzle.position,
            "status": position_status,
            "triesRemaining": tries_remaining,
            "currentTryNumber": in_progress_attempt.try_number,
            "maxTriesPerItem": total_queue,
            "trainingId": run.training_id,
            "scheduleName": schedule_name,
        },
        "trainingItem": {
            "displayId": content.display_id,
            "fen": content.fen,
            "solution": content.moves.split(),
            "rating": content.rating,
            "themes": content.themes,
            "gameUrl": content.game_url,
        },
        "attempt": {
            "id": in_progress_attempt.id,
            "tryNumber": in_progress_attempt.try_number,
            "startedAt": in_progress_attempt.started_at.isoformat(),
            "attemptType": attempt_type_data["attemptType"],
            "countsTowardsTraining": attempt_type_data["countsTowardsTraining"],
            "countsTowardsProgress": attempt_type_data["countsTowardsProgress"],
            "countsTowardsAccuracy": attempt_type_data["countsTowardsAccuracy"],
            "countsTowardsAverageTime": attempt_type_data["countsTowardsAverageTime"],
        },
        "timer": {
            "targetSolveTenths": target_solve_tenths,
        },
        "sessionAttempts": [
            _session_attempt_strip_item(a, total_queue)
            for a in sorted_attempts
        ],
    }


def _run_puzzle_full_dict(run_puzzle: RunTrainingItem) -> dict[str, object]:
    content = get_content(run_puzzle.training_item_id)
    run = db.session.get(Run, run_puzzle.run_id)
    if run is None:
        raise LookupError("Run not found.")
    schedule, config = _get_schedule_config(run)
    total_queue = config.total_queue

    total_puzzles = db.session.scalar(
        sa.select(sa.func.count()).where(RunTrainingItem.run_id == run_puzzle.run_id)
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

    attempt_type_data = attempt_type_fields(sorted_attempts, current_try_number, total_queue)

    return {
        "runTrainingItemId": run_puzzle.id,
        "position": run_puzzle.position,
        "positionStatus": derive_position_status(sorted_attempts, total_queue),
        "displayId": content.display_id,
        "fen": content.fen,
        "solution": content.moves,
        "rating": content.rating,
        "gameUrl": content.game_url,
        "maxTriesPerItem": total_queue,
        "currentTryNumber": current_try_number,
        "currentAttemptId": current_attempt_id,
        "tries": [_attempt_dict(a) for a in sorted_attempts],
        "totalItems": total_puzzles,
        "scheduleName": schedule.name,
        "runIndex": run.run_index,
        "themes": content.themes,
        **attempt_type_data,
    }


def _create_attempt_for_puzzle(run_puzzle: RunTrainingItem) -> TrainingAttempt:
    db.session.execute(
        sa.select(RunTrainingItem.id)
        .where(RunTrainingItem.id == run_puzzle.id)
        .with_for_update()
    )

    existing_in_progress = db.session.scalar(
        sa.select(TrainingAttempt)
        .where(
            TrainingAttempt.run_training_item_id == run_puzzle.id,
            TrainingAttempt.status == "in_progress",
        )
        .order_by(TrainingAttempt.try_number.desc())
        .limit(1)
    )
    if existing_in_progress is not None:
        return existing_in_progress

    max_try_number = db.session.scalar(
        sa.select(sa.func.max(TrainingAttempt.try_number)).where(
            TrainingAttempt.run_training_item_id == run_puzzle.id
        )
    )
    next_try_number = int(max_try_number) + 1 if max_try_number is not None else 1

    attempt = TrainingAttempt(
        run_training_item_id=run_puzzle.id,
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
            sa.select(TrainingAttempt)
            .where(
                TrainingAttempt.run_training_item_id == run_puzzle.id,
                TrainingAttempt.status == "in_progress",
            )
            .order_by(TrainingAttempt.try_number.desc())
            .limit(1)
        )
        if existing_after_race is not None:
            return existing_after_race
        raise


_NICE_INTERVAL_HOURS: list[float] = [0.25, 0.5, 1.0, 2.0, 3.0, 4.0, 6.0, 8.0, 12.0, 24.0, 48.0, 72.0, 120.0, 168.0, 336.0]
_MAX_INTRADAY_INTERVALS = 7
_MAX_MULTIDAY_INTERVALS = 14


def _tick_interval_ms(target_hours: float) -> int:
    if target_hours > 24.0:
        intervals = [h for h in _NICE_INTERVAL_HOURS if h >= 24.0]
        max_count = _MAX_MULTIDAY_INTERVALS
    else:
        intervals = _NICE_INTERVAL_HOURS
        max_count = _MAX_INTRADAY_INTERVALS
    for interval_h in intervals:
        if math.ceil(target_hours / interval_h) <= max_count:
            return int(interval_h * 3_600_000)
    return int(intervals[-1] * 3_600_000)


def _pace_chart_data(
    run: Run,
    run_puzzles: list[RunTrainingItem],
    schedule_cfg: ScheduleConfig,
) -> dict[str, object] | None:
    if run.run_index >= len(schedule_cfg.runs):
        return None
    target_hours = float(schedule_cfg.runs[run.run_index].target_hours)
    total_queue = schedule_cfg.total_queue

    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    start_ms = int(run.started_at.timestamp() * 1000)
    deadline_ms = start_ms + int(target_hours * 3_600_000)
    total_puzzles = len(run_puzzles)

    terminal_timestamps: list[int] = []
    for rp in run_puzzles:
        queue_attempts = sorted(
            [a for a in rp.attempts if a.status != "in_progress" and a.try_number <= total_queue],
            key=lambda a: a.try_number,
        )
        solved = next((a for a in queue_attempts if a.status == "solved"), None)
        if solved is not None and solved.completed_at is not None:
            terminal_timestamps.append(int(solved.completed_at.timestamp() * 1000))
            continue
        if len(queue_attempts) >= total_queue:
            last = queue_attempts[-1]
            if last.status == "failed" and last.completed_at is not None:
                terminal_timestamps.append(int(last.completed_at.timestamp() * 1000))
    terminal_timestamps.sort()

    interval_ms = _tick_interval_ms(target_hours)
    num_intervals = math.ceil(target_hours * 3_600_000 / interval_ms)
    label_ticks = [start_ms + i * interval_ms for i in range(num_intervals + 1)]
    domain_start_ms = start_ms - interval_ms // 8

    last_actual_resolved = 0
    for t in terminal_timestamps:
        if t <= now_ms:
            last_actual_resolved += 1
        else:
            break

    target_rate = total_puzzles / (deadline_ms - start_ms) if deadline_ms > start_ms else 0.0
    expected_at_now = (
        (min(now_ms, deadline_ms) - start_ms) / (deadline_ms - start_ms) * total_puzzles
        if deadline_ms > start_ms
        else float(total_puzzles)
    )
    raw_delta = last_actual_resolved - expected_at_now
    puzzle_delta = abs(round(raw_delta))
    status = "on_pace" if puzzle_delta <= 1 else ("ahead" if raw_delta > 0 else "behind")

    projection_cross_ms: int | None = None
    if target_rate > 0 and last_actual_resolved < total_puzzles:
        projection_cross_ms = int(now_ms + (total_puzzles - last_actual_resolved) / target_rate)

    all_timestamps = sorted(
        {*label_ticks, now_ms, deadline_ms, *([] if projection_cross_ms is None else [projection_cross_ms])}
    )

    series: list[dict[str, object]] = []
    for t in all_timestamps:
        actual: object = None
        if t >= start_ms and t <= now_ms:
            resolved_at_t = sum(1 for ts in terminal_timestamps if ts <= t)
            actual = resolved_at_t

        projection: object = None
        if t >= now_ms:
            raw = last_actual_resolved + target_rate * (t - now_ms)
            projection = min(total_puzzles, raw)

        if deadline_ms > start_ms and t <= deadline_ms:
            frac = max(0.0, min(1.0, (t - start_ms) / (deadline_ms - start_ms)))
            target: float = frac * total_puzzles
        else:
            target = float(total_puzzles)

        series.append({"timeMs": t, "actual": actual, "projection": projection, "target": target})

    return {
        "startMs": start_ms,
        "deadlineMs": deadline_ms,
        "totalItems": total_puzzles,
        "labelTicks": label_ticks,
        "domainStartMs": domain_start_ms,
        "series": series,
        "status": status,
        "itemDelta": puzzle_delta,
        "timeRemainingMs": deadline_ms - now_ms,
    }


def get_active_run_summary(user_id: int) -> dict[str, object] | None:
    row = db.session.execute(
        sa.select(Run.id, Run.run_index, Schedule.name)
        .join(Training, Run.training_id == Training.id)
        .join(Schedule, Training.schedule_id == Schedule.id)
        .where(
            Training.user_id == user_id,
            Run.completed_at.is_(None),
            Run.aborted_at.is_(None),
        )
        .order_by(Run.started_at.desc())
        .limit(1)
    ).first()
    if row is None:
        return None
    run_id, run_index, schedule_name = row
    return {"runId": run_id, "scheduleName": schedule_name, "runIndex": run_index}


def run_dict(run: Run) -> dict[str, object]:
    _, config = _get_schedule_config(run)
    total_queue = config.total_queue

    run_puzzles = list(
        db.session.scalars(sa.select(RunTrainingItem).where(RunTrainingItem.run_id == run.id)).all()
    )

    counts: dict[str, int] = {}
    for rp in run_puzzles:
        s = derive_position_status(rp.attempts, total_queue)
        counts[s] = counts.get(s, 0) + 1

    total = sum(counts.values())
    return {
        "id": run.id,
        "trainingId": run.training_id,
        "runIndex": run.run_index,
        "status": run.status,
        "startedAt": run.started_at.isoformat(),
        "completedAt": run.completed_at.isoformat() if run.completed_at else None,
        "abortedAt": run.aborted_at.isoformat() if run.aborted_at else None,
        "totalItems": total,
        "solvedCount": counts.get("solved", 0),
        "solvedWithRetriesCount": counts.get("solved_with_retries", 0),
        "failedCount": counts.get("failed", 0),
        "inProgressCount": counts.get("in_progress", 0) + counts.get("not_started", 0),
        "currentRunTrainingItemId": _current_run_puzzle_id(run.id, total_queue),
        "targetAccuracy": run.target_accuracy,
        "targetSolveSeconds": run.target_solve_seconds,
        "paceChart": _pace_chart_data(run, run_puzzles, config),
    }


def start_run(training_id: int, user_id: int, expected_run_index: int | None = None) -> Run:
    training = db.session.get(Training, training_id)
    if training is None:
        raise LookupError("Training not found.")
    if training.user_id != user_id:
        raise PermissionError("Access denied.")
    if training.completed_at is not None or training.aborted_at is not None:
        raise ValueError("Training is already terminal.")

    active_run = db.session.scalar(
        sa.select(Run).where(
            Run.training_id == training_id,
            Run.completed_at.is_(None),
            Run.aborted_at.is_(None),
        )
    )
    if active_run is not None:
        raise ValueError("An active run already exists for this training.")

    schedule = db.session.get(Schedule, training.schedule_id)
    if schedule is None:
        raise LookupError("Schedule not found.")
    if not isinstance(schedule.config, dict):
        raise LookupError("Schedule has no config.")
    schedule_cfg = ScheduleConfig.from_dict(schedule.config)
    run_count = len(schedule_cfg.runs)
    puzzle_order = schedule_cfg.puzzle_order

    run_index = db.session.scalar(
        sa.select(sa.func.count()).where(
            Run.training_id == training_id,
            Run.completed_at.isnot(None),
        )
    ) or 0

    if run_index >= run_count:
        raise ValueError("All run slots for this schedule are already completed.")
    if expected_run_index is not None and expected_run_index != run_index:
        raise ValueError("Run slot is no longer startable.")

    puzzle_ids: list[int] = list(
        db.session.scalars(
            sa.select(SubsetTrainingItem.training_item_id)
            .where(SubsetTrainingItem.subset_id == schedule.subset_id)
            .order_by(SubsetTrainingItem.position)
        ).all()
    )

    run = Run(
        training_id=training_id,
        run_index=run_index,
    )
    db.session.add(run)
    db.session.flush()

    if puzzle_order == "random":
        rng = random.Random(run.id)
        puzzle_ids = sorted(puzzle_ids, key=lambda _: rng.random())

    db.session.execute(
        sa.insert(RunTrainingItem),
        [
            {
                "run_id": run.id,
                "position": idx,
                "training_item_id": pid,
            }
            for idx, pid in enumerate(puzzle_ids)
        ],
    )

    db.session.commit()
    return run


def list_runs(training_id: int) -> list[Run]:
    training = db.session.get(Training, training_id)
    if training is None:
        raise LookupError("Training not found.")
    return list(
        db.session.scalars(
            sa.select(Run)
            .where(Run.training_id == training_id)
            .order_by(Run.started_at.asc())
        ).all()
    )


def get_run(run_id: int) -> Run:
    return _get_run(run_id)


def continue_run(run_id: int, user_id: int) -> dict[str, object]:
    run = _get_owned_run(run_id, user_id)
    if run.completed_at is not None or run.aborted_at is not None:
        raise ValueError("Run is not active.")

    _, config = _get_schedule_config(run)
    total_queue = config.total_queue

    existing_attempt = db.session.scalar(
        sa.select(TrainingAttempt)
        .join(RunTrainingItem, TrainingAttempt.run_training_item_id == RunTrainingItem.id)
        .where(
            RunTrainingItem.run_id == run_id,
            TrainingAttempt.status == "in_progress",
        )
    )
    if existing_attempt is not None:
        run_puzzle = db.session.get(RunTrainingItem, existing_attempt.run_training_item_id)
        if run_puzzle is None:
            raise LookupError("Run puzzle not found.")
        return {
            "runCompleted": False,
            "attemptView": _run_puzzle_attempt_view_dict(run_puzzle),
        }

    next_id = _current_run_puzzle_id(run_id, total_queue)
    if next_id is None:
        return {"runCompleted": True, "attemptView": None}

    run_puzzle = db.session.get(RunTrainingItem, next_id)
    if run_puzzle is None:
        raise LookupError("Run puzzle not found.")
    _create_attempt_for_puzzle(run_puzzle)
    db.session.refresh(run_puzzle)
    return {
        "runCompleted": False,
        "attemptView": _run_puzzle_attempt_view_dict(run_puzzle),
    }


def list_run_puzzles(run_id: int) -> dict[str, object]:
    run = _get_run(run_id)
    _, config = _get_schedule_config(run)
    total_queue = config.total_queue

    rows = db.session.execute(
        sa.text("""
            SELECT rp.id AS run_training_item_id,
                   rp.position,
                   rp.training_item_id,
                   COUNT(pa.id) FILTER (WHERE pa.status != 'in_progress') AS try_count,
                   (
                       SELECT pa2.time_spent_ms
                       FROM training_attempts pa2
                       WHERE pa2.run_training_item_id = rp.id
                         AND pa2.status != 'in_progress'
                       ORDER BY pa2.try_number DESC
                       LIMIT 1
                   ) AS time_ms
            FROM run_training_items rp
            LEFT JOIN training_attempts pa ON pa.run_training_item_id = rp.id
            WHERE rp.run_id = :run_id
            GROUP BY rp.id, rp.position, rp.training_item_id
            ORDER BY rp.position
        """),
        {"run_id": run_id},
    ).all()

    training_item_ids = [row.training_item_id for row in rows]
    contents = get_content_batch(training_item_ids)

    rp_ids = [row.run_training_item_id for row in rows]
    attempts_by_puzzle: dict[int, list[TrainingAttempt]] = {rp_id: [] for rp_id in rp_ids}
    for a in db.session.scalars(
        sa.select(TrainingAttempt).where(TrainingAttempt.run_training_item_id.in_(rp_ids))
    ).all():
        attempts_by_puzzle[a.run_training_item_id].append(a)

    training_items: list[dict[str, object]] = [
        {
            "runTrainingItemId": row.run_training_item_id,
            "position": row.position,
            "displayId": contents[row.training_item_id].display_id,
            "rating": contents[row.training_item_id].rating,
            "positionStatus": derive_position_status(
                attempts_by_puzzle[row.run_training_item_id], total_queue
            ),
            "tryCount": int(row.try_count) if row.try_count is not None else 0,
            "timeMs": int(row.time_ms) if row.time_ms is not None else None,
        }
        for row in rows
    ]
    return {"maxTriesPerItem": total_queue, "trainingItems": training_items}


def get_run_puzzle(run_id: int, run_puzzle_id: int, user_id: int) -> dict[str, object]:
    run = _get_owned_run(run_id, user_id)
    run_puzzle = db.session.get(RunTrainingItem, run_puzzle_id)
    if run_puzzle is None or run_puzzle.run_id != run.id:
        raise LookupError("Run puzzle not found.")
    return _run_puzzle_full_dict(run_puzzle)



def _compute_overview_stats(
    run_puzzles: list[RunTrainingItem],
    total_queue: int,
    focus_run_puzzle_id: int,
    selected_attempt_id: int | None,
) -> dict[str, object]:
    def _stats_pass(
        exclude_id: int | None,
    ) -> tuple[int, int, int, list[int]]:
        first_solved = 0
        all_solved = 0
        resolved = 0
        times: list[int] = []

        for rp in run_puzzles:
            if exclude_id is not None and rp.id == exclude_id:
                continue

            completed = sorted(
                [a for a in rp.attempts if a.status != "in_progress"],
                key=lambda a: a.try_number,
            )
            queue_completed = [a for a in completed if a.try_number <= total_queue]
            has_solved = any(a.status == "solved" for a in queue_completed)
            all_failed = not has_solved and len(queue_completed) >= total_queue

            if not (has_solved or all_failed):
                continue

            resolved += 1

            if has_solved:
                all_solved += 1
                if queue_completed and queue_completed[0].status == "solved" and queue_completed[0].try_number == 1:
                    first_solved += 1
                if completed and completed[-1].time_spent_ms is not None:
                    times.append(completed[-1].time_spent_ms)

        return first_solved, all_solved, resolved, times

    first_after, solved_after, resolved_after, times_after = _stats_pass(exclude_id=None)
    first_before, _, resolved_before, times_before = _stats_pass(exclude_id=focus_run_puzzle_id)

    acc_after = (first_after / resolved_after * 100) if resolved_after > 0 else None
    acc_before = (first_before / resolved_before * 100) if resolved_before > 0 else None
    avg_after = (sum(times_after) / len(times_after)) if times_after else None
    avg_before = (sum(times_before) / len(times_before)) if times_before else None

    focus_rp = next((rp for rp in run_puzzles if rp.id == focus_run_puzzle_id), None)
    q_attempt_id: int | None = None
    if focus_rp is not None:
        queue = sorted(
            [a for a in focus_rp.attempts if a.try_number <= total_queue and a.status != "in_progress"],
            key=lambda a: a.try_number,
        )
        first_solved_a = next((a for a in queue if a.status == "solved"), None)
        if first_solved_a is not None:
            q_attempt_id = first_solved_a.id
        elif len(queue) >= total_queue:
            q_attempt_id = queue[-1].id

    is_qualifying = (
        selected_attempt_id is not None
        and q_attempt_id is not None
        and selected_attempt_id == q_attempt_id
    )

    acc_delta: float | None = (
        (acc_after - acc_before)
        if is_qualifying and acc_after is not None and acc_before is not None and resolved_before > 0
        else None
    )
    time_delta: float | None = (
        (avg_after - avg_before)
        if is_qualifying and avg_after is not None and avg_before is not None and len(times_before) > 0
        else None
    )

    return {
        "accuracy": {
            "valuePct": acc_after,
            "deltaPct": acc_delta,
            "solvedCount": solved_after,
            "resolvedCount": resolved_after,
        },
        "averageSolveTime": {
            "valueMs": round(avg_after) if avg_after is not None else None,
            "deltaMs": round(time_delta) if time_delta is not None else None,
            "timeCount": len(times_after),
        },
    }




def _compute_attempt_impact(
    attempt: TrainingAttempt,
    qualifying_attempt_id: int | None,
    run_puzzles: list[RunTrainingItem],
    total_queue: int,
    training_id: int,
) -> dict[str, object]:
    is_qualifying = attempt.id == qualifying_attempt_id

    run_progress_delta_pct: float | None = None
    total_run_puzzles = len(run_puzzles)
    if is_qualifying and total_run_puzzles > 0:
        run_progress_delta_pct = round(1.0 / total_run_puzzles * 100, 2)

    training_progress_delta_pct: float | None = None
    if is_qualifying:
        all_training_runs = list(
            db.session.scalars(
                sa.select(Run).where(Run.training_id == training_id)
            ).all()
        )
        total_training_puzzles = sum(
            db.session.scalar(
                sa.select(sa.func.count()).where(RunTrainingItem.run_id == r.id)
            ) or 0
            for r in all_training_runs
        )
        if total_training_puzzles > 0:
            training_progress_delta_pct = round(1.0 / total_training_puzzles * 100, 2)

    return {
        "runProgressDeltaPct": run_progress_delta_pct,
        "trainingProgressDeltaPct": training_progress_delta_pct,
        "accuracyDeltaPct": None,
        "averageSolveTimeDeltaMs": None,
    }


def _overview_attempt_view(
    attempt: TrainingAttempt,
    run: Run,
    run_puzzle: RunTrainingItem,
    qualifying_attempt_id: int | None,
    total_queue: int,
    puzzle_fen: str,
    puzzle_solution: str,
    run_puzzles: list[RunTrainingItem],
    training_id: int,
) -> dict[str, object]:
    sorted_for_type = sorted(run_puzzle.attempts, key=lambda a: a.try_number)
    type_data = attempt_type_fields(sorted_for_type, attempt.try_number, total_queue)

    impact = _compute_attempt_impact(
        attempt, qualifying_attempt_id, run_puzzles, total_queue, training_id
    )

    return {
        "id": attempt.id,
        "runId": run.id,
        "runIndex": run.run_index,
        "runTrainingItemId": run_puzzle.id,
        "tryNumber": attempt.try_number,
        "status": attempt.status,
        "startedAt": attempt.started_at.isoformat(),
        "completedAt": attempt.completed_at.isoformat() if attempt.completed_at else None,
        "timeSpentMs": attempt.time_spent_ms,
        "moves": attempt.moves if isinstance(attempt.moves, list) else [],
        "attemptType": type_data["attemptType"],
        "isQualifying": attempt.id == qualifying_attempt_id,
        "countsTowardsTraining": type_data["countsTowardsTraining"],
        "countsTowardsProgress": type_data["countsTowardsProgress"],
        "countsTowardsAccuracy": type_data["countsTowardsAccuracy"],
        "countsTowardsAverageTime": type_data["countsTowardsAverageTime"],
        "board": compute_attempt_board(
            puzzle_fen, puzzle_solution, attempt.status,
            attempt.moves if isinstance(attempt.moves, list) else [],
        ),
        "pgnDisplay": compute_attempt_pgn(
            puzzle_fen, puzzle_solution, attempt.status,
            attempt.moves if isinstance(attempt.moves, list) else [],
        ),
        "impact": impact,
    }


def _same_puzzle_run_overview_items(
    run_puzzle: RunTrainingItem,
    training_id: int,
    total_queue: int,
) -> list[dict[str, object]]:
    other_run_puzzles = list(
        db.session.scalars(
            sa.select(RunTrainingItem)
            .join(Run, RunTrainingItem.run_id == Run.id)
            .where(
                Run.training_id == training_id,
                RunTrainingItem.training_item_id == run_puzzle.training_item_id,
                RunTrainingItem.id != run_puzzle.id,
            )
        ).all()
    )

    items: list[dict[str, object]] = []
    for rp in other_run_puzzles:
        other_run = db.session.get(Run, rp.run_id)
        if other_run is None:
            continue
        rp_content = get_content(rp.training_item_id)

        sorted_attempts = sorted(rp.attempts, key=lambda a: a.try_number)
        q_id = qualifying_attempt_id(sorted_attempts, total_queue)

        other_run_puzzles_for_run = list(
            db.session.scalars(
                sa.select(RunTrainingItem).where(RunTrainingItem.run_id == other_run.id)
            ).all()
        )

        attempt_views = [
            _overview_attempt_view(
                a, other_run, rp, q_id, total_queue,
                rp_content.fen, rp_content.moves,
                other_run_puzzles_for_run, training_id,
            )
            for a in sorted_attempts
            if a.status != "in_progress"
        ]

        items.append({
            "runId": other_run.id,
            "runIndex": other_run.run_index,
            "runTrainingItemId": rp.id,
            "runTrainingItemStatus": derive_position_status(sorted_attempts, total_queue),
            "attempts": attempt_views,
        })

    items.sort(key=lambda x: x["runIndex"] if isinstance(x["runIndex"], int) else 0)
    return items


def _compute_progress_card(
    run: Run,
    run_puzzles: list[RunTrainingItem],
    total_queue: int,
    run_progress_delta_pct: float | None,
    training_id: int,
) -> dict[str, object]:
    total_run = len(run_puzzles)
    resolved_run = sum(
        1 for rp in run_puzzles
        if derive_position_status(rp.attempts, total_queue) in (
            "solved", "solved_with_retries", "failed"
        )
    )
    run_pct = round(resolved_run / total_run * 100, 2) if total_run > 0 else 0.0

    run_progress_row: dict[str, object] = {
        "label": f"Run {run.run_index + 1}",
        "value": run_pct,
        "tooltipLabel": f"{resolved_run} of {total_run} puzzles completed",
        "delta": run_progress_delta_pct,
    }

    training = db.session.get(Training, training_id)
    if training is None:
        return {"runProgress": run_progress_row, "trainingProgress": None}

    schedule = db.session.get(Schedule, training.schedule_id)
    subset = None
    if schedule is not None:
        subset = db.session.get(Subset, schedule.subset_id)

    if subset is None or schedule is None or not isinstance(schedule.config, dict):
        return {"runProgress": run_progress_row, "trainingProgress": None}

    run_count = len(ScheduleConfig.from_dict(schedule.config).runs)
    puzzle_count = (
        subset.locked_puzzle_count
        if subset.locked_puzzle_count is not None
        else subset.puzzle_count
    ) or 0
    training_total = run_count * puzzle_count

    if training_total == 0:
        return {"runProgress": run_progress_row, "trainingProgress": None}

    all_runs = list(
        db.session.scalars(
            sa.select(Run).where(Run.training_id == training_id)
        ).all()
    )
    training_resolved = 0
    for r in all_runs:
        all_rps = list(
            db.session.scalars(sa.select(RunTrainingItem).where(RunTrainingItem.run_id == r.id)).all()
        )
        for rp in all_rps:
            if derive_position_status(rp.attempts, total_queue) in (
                "solved", "solved_with_retries", "failed"
            ):
                training_resolved += 1

    training_pct = round(training_resolved / training_total * 100, 2) if training_total > 0 else 0.0
    training_delta: float | None = (
        round(1.0 / training_total * 100, 2)
        if run_progress_delta_pct is not None and training_total > 0
        else None
    )

    training_progress_row: dict[str, object] = {
        "label": schedule.name,
        "value": training_pct,
        "tooltipLabel": f"{training_resolved} of {training_total} puzzles completed across all runs",
        "delta": training_delta,
    }

    return {"runProgress": run_progress_row, "trainingProgress": training_progress_row}


def _compute_overview_actions(run: Run, content: TrainingItemContent) -> dict[str, object]:
    next_enabled = run.completed_at is None and run.aborted_at is None
    disabled_reason: str | None = None
    if run.completed_at is not None:
        disabled_reason = "Run complete"
    elif run.aborted_at is not None:
        disabled_reason = "Run aborted"

    return {
        "runStatus": run.status,
        "retake": {"enabled": True},
        "analyze": {"enabled": True, "url": content.game_url},
        "nextTrainingItem": {"enabled": next_enabled, "disabledReason": disabled_reason},
    }


def _compute_run_complete_overlay(
    run: Run,
    run_puzzles: list[RunTrainingItem],
    total_queue: int,
    run_just_completed: bool,
    completing_attempt_id: int | None,
    break_duration: str | None,
    is_training_complete: bool,
) -> dict[str, object] | None:
    if not run_just_completed or completing_attempt_id is None:
        return None

    total = len(run_puzzles)
    solved = sum(
        1 for rp in run_puzzles
        if derive_position_status(rp.attempts, total_queue) == "solved"
    )
    solved_with_retries = sum(
        1 for rp in run_puzzles
        if derive_position_status(rp.attempts, total_queue) == "solved_with_retries"
    )
    failed = sum(
        1 for rp in run_puzzles
        if derive_position_status(rp.attempts, total_queue) == "failed"
    )

    all_times: list[int] = []
    for rp in run_puzzles:
        completed = sorted(
            [a for a in rp.attempts if a.status != "in_progress"],
            key=lambda a: a.try_number,
        )
        if completed and completed[-1].time_spent_ms is not None:
            all_times.append(completed[-1].time_spent_ms)

    resolved = solved + solved_with_retries + failed
    acc_pct: float | None = (
        round(solved / resolved * 100, 1) if resolved > 0 else None
    )
    avg_time: int | None = (
        round(sum(all_times) / len(all_times)) if all_times else None
    )

    return {
        "completedByAttemptId": completing_attempt_id,
        "runId": run.id,
        "runIndex": run.run_index,
        "breakDuration": break_duration,
        "isTrainingComplete": is_training_complete,
        "summary": {
            "totalItems": total,
            "solvedCount": solved,
            "solvedWithRetriesCount": solved_with_retries,
            "failedCount": failed,
            "accuracyPct": acc_pct,
            "averageSolveTimeMs": avg_time,
        },
    }


def _build_run_puzzle_overview(
    run: Run,
    run_puzzle: RunTrainingItem,
    selected_attempt_id: int | None,
    training_id: int,
    run_just_completed: bool = False,
    completing_attempt_id: int | None = None,
) -> dict[str, object]:
    content = get_content(run_puzzle.training_item_id)

    _, config = _get_schedule_config(run)
    total_queue = config.total_queue

    training = db.session.get(Training, training_id)
    schedule = db.session.get(Schedule, training.schedule_id) if training else None
    schedule_name: str | None = schedule.name if schedule is not None else None

    total_runs = len(config.runs)
    is_training_complete = total_runs > 0 and run.run_index == total_runs - 1
    break_hours = config.runs[run.run_index].break_after_hours if run.run_index < total_runs else 0
    break_duration = _format_break_duration(break_hours)

    all_run_puzzles = list(
        db.session.scalars(sa.select(RunTrainingItem).where(RunTrainingItem.run_id == run.id)).all()
    )

    sorted_attempts = sorted(
        [a for a in run_puzzle.attempts if a.status != "in_progress"],
        key=lambda a: a.try_number,
    )

    valid_ids = {a.id for a in sorted_attempts}
    resolved_selected_id: int | None = (
        selected_attempt_id if selected_attempt_id in valid_ids
        else (sorted_attempts[-1].id if sorted_attempts else None)
    )

    q_attempt_id = qualifying_attempt_id(sorted_attempts, total_queue)

    stats = _compute_overview_stats(
        all_run_puzzles, total_queue, run_puzzle.id, resolved_selected_id
    )

    is_selected_qualifying = (
        resolved_selected_id is not None
        and q_attempt_id is not None
        and resolved_selected_id == q_attempt_id
    )
    accuracy_delta = cast(dict[str, object], stats["accuracy"])["deltaPct"] if is_selected_qualifying else None
    time_delta = cast(dict[str, object], stats["averageSolveTime"])["deltaMs"] if is_selected_qualifying else None

    attempt_views: list[dict[str, object]] = []
    for a in sorted_attempts:
        view = _overview_attempt_view(
            a, run, run_puzzle, q_attempt_id, total_queue,
            content.fen, content.moves, all_run_puzzles, training_id,
        )
        if a.id == q_attempt_id:
            impact = cast(dict[str, object], view["impact"])
            impact["accuracyDeltaPct"] = accuracy_delta
            impact["averageSolveTimeDeltaMs"] = time_delta
        attempt_views.append(view)

    run_progress_delta_pct: float | None = None
    if resolved_selected_id is not None:
        for view in attempt_views:
            if view["id"] == resolved_selected_id:
                impact = cast(dict[str, object], view["impact"])
                run_progress_delta_pct = cast(float | None, impact.get("runProgressDeltaPct"))
                break

    position_status = derive_position_status(run_puzzle.attempts, total_queue)
    position_resolved = position_status in ("solved", "solved_with_retries", "failed")
    tries_in_window = sum(1 for a in sorted_attempts if a.try_number <= total_queue)
    tries_remaining = max(0, total_queue - tries_in_window) if not position_resolved else 0

    target_solve_tenths: int | None = (
        run.target_solve_seconds * 10 if run.target_solve_seconds is not None else None
    )

    return {
        "runTrainingItem": {
            "id": run_puzzle.id,
            "trainingItemId": run_puzzle.training_item_id,
            "runId": run.id,
            "runIndex": run.run_index,
            "position": run_puzzle.position,
            "status": position_status,
            "triesRemaining": tries_remaining,
            "maxTriesPerItem": total_queue,
            "qualifyingAttemptId": q_attempt_id,
            "trainingId": training_id,
            "scheduleName": schedule_name,
        },
        "trainingItem": {
            "displayId": content.display_id,
            "fen": content.fen,
            "solution": content.moves.split(),
            "rating": content.rating,
            "themes": content.themes,
            "gameUrl": content.game_url,
        },
        "selectedAttemptId": resolved_selected_id,
        "attempts": attempt_views,
        "sameTrainingItemAcrossRuns": _same_puzzle_run_overview_items(
            run_puzzle, training_id, total_queue
        ),
        "runPace": {
            "chartData": _pace_chart_data(run, all_run_puzzles, config),
            "isRunActive": run.completed_at is None and run.aborted_at is None,
        },
        "stats": {
            "runIndex": run.run_index,
            "accuracy": stats["accuracy"],
            "averageSolveTime": stats["averageSolveTime"],
        },
        "progress": _compute_progress_card(
            run, all_run_puzzles, total_queue, run_progress_delta_pct, training_id
        ),
        "actions": _compute_overview_actions(run, content),
        "timer": {
            "targetSolveTenths": target_solve_tenths,
        },
        "runCompleteOverlay": _compute_run_complete_overlay(
            run, all_run_puzzles, total_queue, run_just_completed, completing_attempt_id,
            break_duration, is_training_complete,
        ),
    }


def get_run_puzzle_overview(
    run_id: int,
    run_puzzle_id: int,
    user_id: int,
    selected_attempt_id: int | None = None,
) -> dict[str, object]:
    run = _get_owned_run(run_id, user_id)
    run_puzzle = db.session.get(RunTrainingItem, run_puzzle_id)
    if run_puzzle is None or run_puzzle.run_id != run.id:
        raise LookupError("Run puzzle not found.")
    overview = _build_run_puzzle_overview(
        run, run_puzzle, selected_attempt_id, run.training_id
    )
    return {
        "overview": overview,
        "selectedAttemptId": overview["selectedAttemptId"],
    }


def start_puzzle(run_id: int, run_puzzle_id: int, user_id: int) -> dict[str, object]:
    run = _get_owned_run(run_id, user_id)
    run_puzzle = db.session.get(RunTrainingItem, run_puzzle_id)
    if run_puzzle is None or run_puzzle.run_id != run.id:
        raise LookupError("Run puzzle not found.")

    existing = db.session.scalar(
        sa.select(TrainingAttempt).where(
            TrainingAttempt.run_training_item_id == run_puzzle_id,
            TrainingAttempt.status == "in_progress",
        )
    )
    if existing is None:
        _create_attempt_for_puzzle(run_puzzle)
        db.session.refresh(run_puzzle)

    return _run_puzzle_attempt_view_dict(run_puzzle)




def complete_attempt(
    attempt_id: int,
    user_id: int,
    run_id: int,
    run_puzzle_id: int,
    uci_moves: list[str],
    client_time_spent_ms: int | None = None,
) -> dict[str, object]:
    attempt, run_puzzle, run = _get_owned_attempt(attempt_id, user_id)

    if run.id != run_id or run_puzzle.id != run_puzzle_id:
        raise LookupError("Attempt not found.")

    if attempt.status != "in_progress":
        raise ValueError("Attempt is already completed.")

    _, config = _get_schedule_config(run)
    total_queue = config.total_queue
    is_queue_attempt = attempt.try_number <= total_queue

    content = get_content(run_puzzle.training_item_id)

    outcome = derive_attempt_outcome(content.fen, content.moves, uci_moves)

    now = datetime.now(timezone.utc)
    attempt.status = outcome
    attempt.completed_at = now
    if client_time_spent_ms is not None:
        attempt.time_spent_ms = min(client_time_spent_ms, MAX_PUZZLE_TIME_MS)
    else:
        attempt.time_spent_ms = min(
            int((now - attempt.started_at).total_seconds() * 1000), MAX_PUZZLE_TIME_MS
        )
    attempt.moves = uci_moves

    position_status = derive_position_status(run_puzzle.attempts, total_queue)
    position_resolved = position_status in ("solved", "solved_with_retries", "failed")

    if is_queue_attempt and position_resolved and run.completed_at is None and run.aborted_at is None:
        db.session.flush()
        if _all_puzzles_terminal(run.id, total_queue):
            run.completed_at = now
            training = db.session.get(Training, run.training_id)
            if training is not None:
                schedule = db.session.get(Schedule, training.schedule_id)
                if schedule is not None and isinstance(schedule.config, dict):
                    run_count = len(ScheduleConfig.from_dict(schedule.config).runs)
                    if run.run_index == run_count - 1:
                        training.completed_at = now

    run_just_completed = run.completed_at == now

    db.session.commit()
    db.session.refresh(run_puzzle)

    overview = _build_run_puzzle_overview(
        run, run_puzzle, attempt_id, run.training_id,
        run_just_completed=run_just_completed,
        completing_attempt_id=attempt_id,
    )

    return {
        "completedAttemptId": attempt_id,
        "outcome": outcome,
        "runCompletedByThisAttempt": run_just_completed,
        "overview": overview,
    }


def get_training_item_history(run_id: int, training_item_id: int, user_id: int) -> dict[str, object]:
    run = _get_owned_run(run_id, user_id)
    content = get_content(training_item_id)

    _, config = _get_schedule_config(run)
    total_queue = config.total_queue

    run_training_items = list(
        db.session.scalars(
            sa.select(RunTrainingItem)
            .where(
                RunTrainingItem.run_id == run_id,
                RunTrainingItem.training_item_id == training_item_id,
            )
            .order_by(RunTrainingItem.position)
        ).all()
    )
    if not run_training_items:
        raise LookupError("Training item not found in this run.")

    positions: list[dict[str, object]] = []
    for rp in run_training_items:
        completed = [a for a in rp.attempts if a.status != "in_progress"]
        if not completed:
            continue
        positions.append({
            "position": rp.position,
            "positionStatus": derive_position_status(rp.attempts, total_queue),
            "tries": [
                _attempt_dict(a) for a in sorted(completed, key=lambda a: a.try_number)
            ],
        })

    return {
        "displayId": content.display_id,
        "solution": content.moves,
        "maxTriesPerItem": total_queue,
        "positions": positions,
    }


def abort_run(run_id: int, user_id: int) -> Run:
    run = _get_owned_run(run_id, user_id)
    if run.completed_at is not None or run.aborted_at is not None:
        raise ValueError("Run is already terminal.")
    run.aborted_at = datetime.now(timezone.utc)
    db.session.commit()
    return run


def get_attempt(
    run_id: int, run_puzzle_id: int, attempt_id: int, user_id: int
) -> dict[str, object]:
    run = _get_owned_run(run_id, user_id)
    run_puzzle = db.session.get(RunTrainingItem, run_puzzle_id)
    if run_puzzle is None or run_puzzle.run_id != run.id:
        raise LookupError("Run puzzle not found.")
    attempt = db.session.get(TrainingAttempt, attempt_id)
    if attempt is None or attempt.run_training_item_id != run_puzzle.id:
        raise LookupError("Attempt not found.")

    if attempt.status == "in_progress":
        return {
            "kind": "active_attempt",
            "attemptView": _run_puzzle_attempt_view_dict(run_puzzle),
        }

    overview_url = (
        f"/app/runs/{run_id}/training-items/{run_puzzle_id}/overview?attempt={attempt_id}"
    )
    overview = _build_run_puzzle_overview(
        run, run_puzzle, attempt_id, run.training_id
    )
    return {
        "kind": "completed_attempt",
        "overviewUrl": overview_url,
        "overview": overview,
    }
