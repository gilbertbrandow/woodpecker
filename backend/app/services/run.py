import bisect
import random
from datetime import datetime, timezone
from typing import cast
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import sqlalchemy as sa
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.extensions import db
from app.models.run import MAX_PUZZLE_TIME_MS, TrainingAttempt, Run, RunTrainingItem
from app.models.schedule import Schedule
from app.models.training import Training
from app.models.subset import Subset, SubsetTrainingItem
from app.exceptions import ConflictError, NotFoundError, ForbiddenError
from app.table_query import DateFilter, FilterList, RangeFilter
from app.services.attempt_state import (
    attempt_type_fields,
    derive_attempt_outcome,
    derive_position_status,
    qualifying_attempt_id,
)
from app.services.chess_board import compute_attempt_board, compute_attempt_pgn
from app.services.schedule_config import ScheduleConfig
from app.services.solve_contract import SolveContract
from app.services.training_item_content import (
    DecoyMetadata,
    LichessTacticMetadata,
    ScrapedPositionalMetadata,
    SourceMetadata,
    get_content,
    get_content_batch,
)


def _get_run(run_id: int) -> Run:
    run = db.session.get(Run, run_id)
    if run is None:
        raise NotFoundError("Run not found", "The requested run does not exist.")
    return run


def _get_owned_run(run_id: int, user_id: int) -> Run:
    run = _get_run(run_id)
    training = db.session.get(Training, run.training_id)
    if training is None or training.user_id != user_id:
        raise ForbiddenError("Access denied", "You do not have permission to perform this action.")
    return run


def _get_owned_attempt(
    attempt_id: int, user_id: int
) -> tuple[TrainingAttempt, RunTrainingItem, Run]:
    attempt = db.session.get(TrainingAttempt, attempt_id)
    if attempt is None:
        raise NotFoundError("Attempt not found", "The requested attempt does not exist.")
    run_puzzle = db.session.get(RunTrainingItem, attempt.run_training_item_id)
    if run_puzzle is None:
        raise NotFoundError("Puzzle not found", "The requested puzzle could not be found in this run.")
    run = _get_owned_run(run_puzzle.run_id, user_id)
    return attempt, run_puzzle, run


def _get_schedule_config(run: Run) -> tuple[Schedule, ScheduleConfig]:
    training = db.session.get(Training, run.training_id)
    if training is None:
        raise NotFoundError("Training not found", "The requested training does not exist.")
    schedule = db.session.get(Schedule, training.schedule_id)
    if schedule is None:
        raise NotFoundError("Schedule not found", "The requested schedule does not exist or has been deleted.")
    if not isinstance(schedule.config, dict):
        raise NotFoundError("Schedule not configured", "This schedule does not have a configuration set.")
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
    payload = get_content(run_puzzle.training_item_id)
    run = db.session.get(Run, run_puzzle.run_id)
    if run is None:
        raise NotFoundError("Run not found", "The requested run does not exist.")
    _, config = _get_schedule_config(run)
    total_queue = config.total_queue

    sorted_attempts = sorted(run_puzzle.attempts, key=lambda a: a.try_number)
    in_progress_attempt = next((a for a in sorted_attempts if a.status == "in_progress"), None)
    if in_progress_attempt is None:
        raise NotFoundError("No active attempt", "There is no in-progress attempt for this puzzle.")

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

    target_min_solve_tenths: int | None = (
        run.target_min_solve_seconds * 10 if run.target_min_solve_seconds is not None else None
    )
    target_max_solve_tenths: int | None = (
        run.target_max_solve_seconds * 10 if run.target_max_solve_seconds is not None else None
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
            "fen": payload.contract.fen,
            "solution": payload.contract.plies,
            "source": payload.metadata.to_api_dict(),
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
            "targetMinSolveTenths": target_min_solve_tenths,
            "targetMaxSolveTenths": target_max_solve_tenths,
        },
        "sessionAttempts": [
            _session_attempt_strip_item(a, total_queue)
            for a in sorted_attempts
        ],
    }


def _run_puzzle_full_dict(run_puzzle: RunTrainingItem) -> dict[str, object]:
    payload = get_content(run_puzzle.training_item_id)
    run = db.session.get(Run, run_puzzle.run_id)
    if run is None:
        raise NotFoundError("Run not found", "The requested run does not exist.")
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
        "source": payload.metadata.to_api_dict(),
        "fen": payload.contract.fen,
        "solution": payload.contract.plies,
        "maxTriesPerItem": total_queue,
        "currentTryNumber": current_try_number,
        "currentAttemptId": current_attempt_id,
        "tries": [_attempt_dict(a) for a in sorted_attempts],
        "totalItems": total_puzzles,
        "scheduleName": schedule.name,
        "runIndex": run.run_index,
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


_HOUR_MS = 3_600_000
_DAY_MS = 24 * _HOUR_MS


def _parse_tz(tz_str: str) -> ZoneInfo:
    try:
        return ZoneInfo(tz_str)
    except ZoneInfoNotFoundError:
        return ZoneInfo("UTC")


def _compute_terminal_timestamps(run_puzzles: list[RunTrainingItem], total_queue: int) -> list[int]:
    result: list[int] = []
    for rp in run_puzzles:
        queue_attempts = sorted(
            [a for a in rp.attempts if a.status != "in_progress" and a.try_number <= total_queue],
            key=lambda a: a.try_number,
        )
        solved = next((a for a in queue_attempts if a.status == "solved"), None)
        if solved is not None and solved.completed_at is not None:
            result.append(int(solved.completed_at.timestamp() * 1000))
            continue
        if len(queue_attempts) >= total_queue:
            last = queue_attempts[-1]
            if last.status == "failed" and last.completed_at is not None:
                result.append(int(last.completed_at.timestamp() * 1000))
    result.sort()
    return result


def _resolved_count_at(terminal_timestamps: list[int], t_ms: int) -> int:
    return bisect.bisect_right(terminal_timestamps, t_ms)


def _required_at(t_ms: int, start_ms: int, deadline_ms: int, total_puzzles: int) -> float:
    if t_ms <= start_ms:
        return 0.0
    if t_ms >= deadline_ms:
        return float(total_puzzles)
    return (t_ms - start_ms) / (deadline_ms - start_ms) * total_puzzles


def _compute_projected_finish(
    as_of_ms: int,
    resolved_at_as_of: int,
    total_puzzles: int,
    schedule_rate: float,
) -> int | None:
    if schedule_rate <= 0 or resolved_at_as_of >= total_puzzles:
        return None
    return int(as_of_ms + (total_puzzles - resolved_at_as_of) / schedule_rate)


def _compute_domain_end(
    run_status: str,
    deadline_ms: int,
    projected_finish_ms: int | None,
    completed_at_ms: int | None,
    aborted_at_ms: int | None,
) -> int:
    if run_status == "active":
        return max(deadline_ms, projected_finish_ms or deadline_ms)
    if run_status == "completed":
        return max(deadline_ms, completed_at_ms or deadline_ms)
    return max(deadline_ms, aborted_at_ms or deadline_ms)


def _short_label(t_ms: int, kind: str, domain_len_ms: int, tz: ZoneInfo) -> str:
    dt = datetime.fromtimestamp(t_ms / 1000, tz=tz)
    if domain_len_ms <= 48 * _HOUR_MS:
        return f"{dt.hour:02d}:{dt.minute:02d}"
    if domain_len_ms <= 7 * _DAY_MS:
        return dt.strftime("%a")
    if domain_len_ms <= 30 * _DAY_MS:
        return f"{dt.day} {dt.strftime('%b')}"
    return dt.strftime("%b")


def _generate_label_ticks(
    domain_start_ms: int,
    domain_end_ms: int,
    start_ms: int,
    deadline_ms: int,
    run_status: str,
    projected_finish_ms: int | None,
    tz: ZoneInfo,
) -> list[dict[str, object]]:
    domain_len_ms = domain_end_ms - domain_start_ms
    # Ticks per domain length: 8 for ≤7d (one per day for a typical 1-week run), 7 elsewhere.
    n = 8 if domain_len_ms <= 7 * _DAY_MS else 7

    # Uniformly space n ticks from domain start to domain end.
    tick_times = [
        domain_start_ms + round(i * domain_len_ms / (n - 1))
        for i in range(n)
    ]

    def _kind(i: int) -> str:
        if i == 0:
            return "start"
        if i == n - 1:
            if run_status == "active" and projected_finish_ms is not None and domain_end_ms > deadline_ms:
                return "projected_finish"
            if run_status == "completed" and domain_end_ms > deadline_ms:
                return "completed"
            if run_status == "aborted" and domain_end_ms > deadline_ms:
                return "aborted"
            return "deadline"
        return "calendar"

    result = []
    for i, t in enumerate(tick_times):
        k = _kind(i)
        result.append({"timeMs": t, "kind": k, "shortLabel": _short_label(t, k, domain_len_ms, tz)})
    return result


def _generate_series(
    label_tick_times: set[int],
    special_times: dict[int, str],
    as_of_ms: int,
    terminal_timestamps: list[int],
    total_puzzles: int,
    start_ms: int,
    deadline_ms: int,
    schedule_rate: float,
    is_active: bool,
    resolved_at_as_of: int,
) -> list[dict[str, object]]:
    all_times = sorted(label_tick_times | set(special_times.keys()))
    series: list[dict[str, object]] = []
    for t in all_times:
        actual: object = _resolved_count_at(terminal_timestamps, t) if t <= as_of_ms else None
        required = _required_at(t, start_ms, deadline_ms, total_puzzles)
        projection: object = None
        if is_active and t >= as_of_ms:
            projection = min(float(total_puzzles), resolved_at_as_of + schedule_rate * (t - as_of_ms))
        point: dict[str, object] = {"timeMs": t, "actual": actual, "required": required, "projection": projection}
        kind = special_times.get(t)
        if kind is not None:
            point["kind"] = kind
        series.append(point)
    return series


def _build_pace_summary(
    run_status: str,
    as_of_ms: int,
    deadline_ms: int,
    total_puzzles: int,
    resolved_at_as_of: int,
    required_at_as_of: float,
    projected_finish_ms: int | None,
    completed_at_ms: int | None,
    aborted_at_ms: int | None,
) -> dict[str, object]:
    remaining = total_puzzles - resolved_at_as_of
    delta = resolved_at_as_of - required_at_as_of

    if run_status == "completed":
        state = "completed"
    elif run_status == "aborted":
        state = "aborted"
    elif as_of_ms >= deadline_ms:
        state = "active_overdue"
    elif abs(delta) <= 1:
        state = "active_on_pace"
    elif delta > 0:
        state = "active_ahead"
    else:
        state = "active_behind"

    return {
        "state": state,
        "resolvedItems": resolved_at_as_of,
        "totalItems": total_puzzles,
        "remainingItems": remaining,
        "deltaItemsVsRequired": delta,
        "deadlineDeltaMs": deadline_ms - as_of_ms,
        "projectedFinishMs": projected_finish_ms,
        "completedAtMs": completed_at_ms,
        "abortedAtMs": aborted_at_ms,
        "completedDeltaMs": (deadline_ms - completed_at_ms) if completed_at_ms is not None else None,
        "abortedDeltaMs": (deadline_ms - aborted_at_ms) if aborted_at_ms is not None else None,
    }


def _pace_chart_data(
    run: Run,
    run_puzzles: list[RunTrainingItem],
    schedule_cfg: ScheduleConfig,
    tz_str: str = "UTC",
) -> dict[str, object] | None:
    if run.run_index >= len(schedule_cfg.runs):
        return None

    target_hours = float(schedule_cfg.runs[run.run_index].target_hours)
    total_queue = schedule_cfg.total_queue
    total_puzzles = len(run_puzzles)
    tz = _parse_tz(tz_str)

    start_ms = int(run.started_at.timestamp() * 1000)
    deadline_ms = start_ms + int(target_hours * 3_600_000)

    completed_at_ms: int | None = (
        int(run.completed_at.timestamp() * 1000) if run.completed_at is not None else None
    )
    aborted_at_ms: int | None = (
        int(run.aborted_at.timestamp() * 1000) if run.aborted_at is not None else None
    )

    if completed_at_ms is not None:
        run_status = "completed"
    elif aborted_at_ms is not None:
        run_status = "aborted"
    else:
        run_status = "active"

    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    as_of_ms = completed_at_ms if completed_at_ms is not None else (aborted_at_ms if aborted_at_ms is not None else now_ms)

    terminal_timestamps = _compute_terminal_timestamps(run_puzzles, total_queue)
    resolved_at_as_of = _resolved_count_at(terminal_timestamps, as_of_ms)

    schedule_rate = total_puzzles / (deadline_ms - start_ms) if deadline_ms > start_ms else 0.0
    required_at_as_of = _required_at(as_of_ms, start_ms, deadline_ms, total_puzzles)

    is_active = run_status == "active"
    projected_finish_ms = (
        _compute_projected_finish(as_of_ms, resolved_at_as_of, total_puzzles, schedule_rate)
        if is_active
        else None
    )

    domain_start_ms = start_ms
    domain_end_ms = _compute_domain_end(
        run_status, deadline_ms, projected_finish_ms, completed_at_ms, aborted_at_ms
    )

    label_ticks = _generate_label_ticks(
        domain_start_ms, domain_end_ms, start_ms, deadline_ms, run_status, projected_finish_ms, tz
    )
    label_tick_times: set[int] = {cast(int, t["timeMs"]) for t in label_ticks}
    # Build in ascending priority order so that later (more specific) kinds win
    # when two timestamps collide (e.g. domain_end_ms == deadline_ms).
    special_times: dict[int, str] = {
        domain_end_ms: "domain_end",
        as_of_ms: "as_of",
        start_ms: "start",
        deadline_ms: "deadline",
    }
    if projected_finish_ms is not None:
        special_times[projected_finish_ms] = "projected_finish"
    if completed_at_ms is not None:
        special_times[completed_at_ms] = "completed"
    if aborted_at_ms is not None:
        special_times[aborted_at_ms] = "aborted"

    series = _generate_series(
        label_tick_times, special_times,
        as_of_ms, terminal_timestamps,
        total_puzzles, start_ms, deadline_ms,
        schedule_rate, is_active, resolved_at_as_of,
    )
    summary = _build_pace_summary(
        run_status, as_of_ms, deadline_ms,
        total_puzzles, resolved_at_as_of, required_at_as_of,
        projected_finish_ms, completed_at_ms, aborted_at_ms,
    )

    return {
        "runStatus": run_status,
        "startMs": start_ms,
        "deadlineMs": deadline_ms,
        "asOfMs": as_of_ms,
        "domainStartMs": domain_start_ms,
        "domainEndMs": domain_end_ms,
        "totalItems": total_puzzles,
        "resolvedItems": resolved_at_as_of,
        "requiredResolvedAtAsOf": required_at_as_of,
        "projectedFinishMs": projected_finish_ms,
        "labelTicks": label_ticks,
        "series": series,
        "summary": summary,
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


def run_dict(run: Run, tz: str = "UTC") -> dict[str, object]:
    _, config = _get_schedule_config(run)
    total_queue = config.total_queue

    run_puzzles = list(
        db.session.scalars(
            sa.select(RunTrainingItem)
            .options(selectinload(RunTrainingItem.attempts))
            .where(RunTrainingItem.run_id == run.id)
        ).all()
    )

    counts: dict[str, int] = {}
    solve_times: list[int] = []
    for rp in run_puzzles:
        s = derive_position_status(rp.attempts, total_queue)
        counts[s] = counts.get(s, 0) + 1
        if s in ("solved", "solved_with_retries"):
            completed = sorted(
                [a for a in rp.attempts if a.status != "in_progress"],
                key=lambda a: a.try_number,
            )
            if completed and completed[-1].time_spent_ms is not None:
                solve_times.append(completed[-1].time_spent_ms)

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
        "avgSolveTimeMs": round(sum(solve_times) / len(solve_times)) if solve_times else None,
        "fastestSolveTimeMs": min(solve_times) if solve_times else None,
        "currentRunTrainingItemId": _current_run_puzzle_id(run.id, total_queue),
        "targetAccuracy": run.target_accuracy,
        "targetMinSolveSeconds": run.target_min_solve_seconds,
        "targetMaxSolveSeconds": run.target_max_solve_seconds,
        "paceChart": _pace_chart_data(run, run_puzzles, config, tz),
    }


def start_run(training_id: int, user_id: int, expected_run_index: int | None = None) -> Run:
    training = db.session.get(Training, training_id)
    if training is None:
        raise NotFoundError("Training not found", "The requested training does not exist.")
    if training.user_id != user_id:
        raise ForbiddenError("Access denied", "You do not have permission to perform this action.")
    if training.completed_at is not None or training.aborted_at is not None:
        raise ConflictError("Training already ended", "This training has already been completed or aborted.")

    cross_training_active = db.session.scalar(
        sa.select(Run)
        .join(Training, Run.training_id == Training.id)
        .where(
            Training.user_id == user_id,
            Run.training_id != training_id,
            Run.completed_at.is_(None),
            Run.aborted_at.is_(None),
        )
    )
    if cross_training_active is not None:
        raise ConflictError("Active run elsewhere", "You already have an active run in another training. Complete or abort it before starting a new one.")

    active_run = db.session.scalar(
        sa.select(Run).where(
            Run.training_id == training_id,
            Run.completed_at.is_(None),
            Run.aborted_at.is_(None),
        )
    )
    if active_run is not None:
        raise ConflictError("Run already active", "This training already has an active run in progress.")

    schedule = db.session.get(Schedule, training.schedule_id)
    if schedule is None:
        raise NotFoundError("Schedule not found", "The requested schedule does not exist or has been deleted.")
    if not isinstance(schedule.config, dict):
        raise NotFoundError("Schedule not configured", "This schedule does not have a configuration set.")
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
        raise ConflictError("All runs completed", "Every run in this schedule has already been completed.")
    if expected_run_index is not None and expected_run_index != run_index:
        raise ConflictError("Run unavailable", "This run slot can no longer be started.")

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
        raise NotFoundError("Training not found", "The requested training does not exist.")
    return list(
        db.session.scalars(
            sa.select(Run)
            .where(Run.training_id == training_id)
            .order_by(Run.started_at.asc())
        ).all()
    )


# SQL expression for the run's derived status (mirrors Run.status property).
_RUN_STATUS_SQL: dict[str, str] = {
    "aborted": "r.aborted_at IS NOT NULL",
    "completed": "r.aborted_at IS NULL AND r.completed_at IS NOT NULL",
    "active": "r.aborted_at IS NULL AND r.completed_at IS NULL",
}


def list_runs_paged(
    training_id: int,
    page: int = 1,
    page_size: int = 20,
    status: FilterList | None = None,
    started_at: DateFilter | None = None,
    completed_at: DateFilter | None = None,
) -> dict[str, object]:
    training = db.session.get(Training, training_id)
    if training is None:
        raise NotFoundError("Training not found", "The requested training does not exist.")

    conditions: list[str] = ["r.training_id = :training_id"]
    params: dict[str, object] = {"training_id": training_id}

    if status is not None and status.str_values:
        valid = [v for v in status.str_values if v in _RUN_STATUS_SQL]
        if valid:
            parts = [f"({_RUN_STATUS_SQL[v]})" for v in valid]
            if status.op == "is_not":
                conditions.append("NOT (" + " OR ".join(parts) + ")")
            else:
                conditions.append("(" + " OR ".join(parts) + ")")

    if started_at is not None:
        started_at.apply(conditions, params, "DATE(r.started_at)", prefix="sa")

    if completed_at is not None:
        completed_at.apply(conditions, params, "DATE(r.completed_at)", prefix="ca")

    where = "WHERE " + " AND ".join(conditions)

    select_sql = f"""
        SELECT r.id
        FROM runs r
        {where}
        ORDER BY r.run_index ASC
    """

    params["limit"] = page_size
    params["offset"] = (page - 1) * page_size
    run_ids: list[int] = [
        row[0]
        for row in db.session.execute(
            sa.text(select_sql + " LIMIT :limit OFFSET :offset"), params
        ).all()
    ]
    total: int = db.session.scalar(
        sa.text(f"SELECT COUNT(*) FROM runs r {where}"),
        {k: v for k, v in params.items() if k not in ("limit", "offset")},
    ) or 0

    runs_by_id: dict[int, Run] = {}
    if run_ids:
        for run in db.session.scalars(sa.select(Run).where(Run.id.in_(run_ids))).all():
            runs_by_id[run.id] = run

    items = [run_dict(runs_by_id[rid]) for rid in run_ids if rid in runs_by_id]
    return {"items": items, "total": total}


def get_run(run_id: int) -> Run:
    return _get_run(run_id)


def continue_run(run_id: int, user_id: int) -> dict[str, object]:
    run = _get_owned_run(run_id, user_id)
    if run.completed_at is not None or run.aborted_at is not None:
        raise ConflictError("Run not active", "This run is not currently active.")

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
            raise NotFoundError("Puzzle not found", "The requested puzzle could not be found in this run.")
        return {
            "runCompleted": False,
            "attemptView": _run_puzzle_attempt_view_dict(run_puzzle),
        }

    next_id = _current_run_puzzle_id(run_id, total_queue)
    if next_id is None:
        return {"runCompleted": True, "attemptView": None}

    run_puzzle = db.session.get(RunTrainingItem, next_id)
    if run_puzzle is None:
        raise NotFoundError("Puzzle not found", "The requested puzzle could not be found in this run.")
    _create_attempt_for_puzzle(run_puzzle)
    db.session.refresh(run_puzzle)
    return {
        "runCompleted": False,
        "attemptView": _run_puzzle_attempt_view_dict(run_puzzle),
    }


def list_run_puzzles(
    run_id: int,
    page: int = 1,
    page_size: int = 25,
    source_type: FilterList | None = None,
    position_status: FilterList | None = None,
    time_ms: RangeFilter | None = None,
    rating: RangeFilter | None = None,
) -> dict[str, object]:
    run = _get_run(run_id)
    _, config = _get_schedule_config(run)
    total_queue = config.total_queue

    cte_sql = """
        WITH base AS (
            SELECT
                rp.id AS run_training_item_id,
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
                ) AS time_ms,
                CASE
                    WHEN NOT EXISTS (SELECT 1 FROM training_attempts WHERE run_training_item_id = rp.id)
                        THEN 'not_started'
                    WHEN EXISTS (SELECT 1 FROM training_attempts WHERE run_training_item_id = rp.id AND status = 'in_progress')
                        THEN 'in_progress'
                    WHEN EXISTS (
                        SELECT 1 FROM training_attempts
                        WHERE run_training_item_id = rp.id AND status = 'solved'
                          AND try_number = 1 AND try_number <= :total_queue
                    ) THEN 'solved'
                    WHEN EXISTS (
                        SELECT 1 FROM training_attempts
                        WHERE run_training_item_id = rp.id AND status = 'solved'
                          AND try_number <= :total_queue
                    ) THEN 'solved_with_retries'
                    WHEN (
                        SELECT COUNT(*) FROM training_attempts
                        WHERE run_training_item_id = rp.id
                          AND status != 'in_progress' AND try_number <= :total_queue
                    ) >= :total_queue THEN 'failed'
                    ELSE 'in_progress'
                END AS position_status,
                ti.source_type,
                lt.rating AS lichess_rating,
                spd.min_rating
            FROM run_training_items rp
            JOIN training_items ti ON ti.id = rp.training_item_id
            LEFT JOIN training_attempts pa ON pa.run_training_item_id = rp.id
            LEFT JOIN lichess_tactics lt ON lt.training_item_id = rp.training_item_id
            LEFT JOIN scraped_positional_puzzles spp ON spp.training_item_id = rp.training_item_id
            LEFT JOIN scraped_positional_difficulties spd ON spd.id = spp.difficulty_id
            WHERE rp.run_id = :run_id
            GROUP BY rp.id, rp.position, rp.training_item_id, ti.source_type, lt.rating, spd.min_rating
        )
    """

    conditions: list[str] = []
    params: dict[str, object] = {"run_id": run_id, "total_queue": total_queue}

    if source_type is not None:
        source_type.apply(conditions, params, "source_type", "st")
    if position_status is not None:
        position_status.apply(conditions, params, "position_status", "ps")
    if time_ms is not None:
        time_ms.apply(conditions, params, "time_ms", "tms", as_int=True)
    if rating is not None:
        rating.apply(conditions, params, "COALESCE(lichess_rating, min_rating)", "rat", as_int=True)

    where_sql = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    total: int = db.session.scalar(
        sa.text(f"{cte_sql} SELECT COUNT(*) FROM base {where_sql}"),
        params,
    ) or 0

    rows = db.session.execute(
        sa.text(f"{cte_sql} SELECT * FROM base {where_sql} ORDER BY position LIMIT :limit OFFSET :offset"),
        {**params, "limit": page_size, "offset": (page - 1) * page_size},
    ).all()

    rp_ids = [row.run_training_item_id for row in rows]
    training_item_ids = [row.training_item_id for row in rows]
    payloads = get_content_batch(training_item_ids)

    attempts_by_puzzle: dict[int, list[TrainingAttempt]] = {rp_id: [] for rp_id in rp_ids}
    if rp_ids:
        for a in db.session.scalars(
            sa.select(TrainingAttempt).where(TrainingAttempt.run_training_item_id.in_(rp_ids))
        ).all():
            attempts_by_puzzle[a.run_training_item_id].append(a)

    items: list[dict[str, object]] = [
        {
            "runTrainingItemId": row.run_training_item_id,
            "position": row.position,
            "source": payloads[row.training_item_id].metadata.to_api_dict(),
            "positionStatus": derive_position_status(
                attempts_by_puzzle[row.run_training_item_id], total_queue
            ),
            "tryCount": int(row.try_count) if row.try_count is not None else 0,
            "timeMs": int(row.time_ms) if row.time_ms is not None else None,
        }
        for row in rows
    ]
    return {"maxTriesPerItem": total_queue, "items": items, "total": total}


def get_run_puzzle(run_id: int, run_puzzle_id: int, user_id: int) -> dict[str, object]:
    run = _get_owned_run(run_id, user_id)
    run_puzzle = db.session.get(RunTrainingItem, run_puzzle_id)
    if run_puzzle is None or run_puzzle.run_id != run.id:
        raise NotFoundError("Puzzle not found", "The requested puzzle could not be found in this run.")
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
    contract: SolveContract,
    run_puzzles: list[RunTrainingItem],
    training_id: int,
) -> dict[str, object]:
    sorted_for_type = sorted(run_puzzle.attempts, key=lambda a: a.try_number)
    type_data = attempt_type_fields(sorted_for_type, attempt.try_number, total_queue)

    impact = _compute_attempt_impact(
        attempt, qualifying_attempt_id, run_puzzles, total_queue, training_id
    )

    attempt_moves = attempt.moves if isinstance(attempt.moves, list) else []
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
        "moves": attempt_moves,
        "attemptType": type_data["attemptType"],
        "isQualifying": attempt.id == qualifying_attempt_id,
        "countsTowardsTraining": type_data["countsTowardsTraining"],
        "countsTowardsProgress": type_data["countsTowardsProgress"],
        "countsTowardsAccuracy": type_data["countsTowardsAccuracy"],
        "countsTowardsAverageTime": type_data["countsTowardsAverageTime"],
        "board": compute_attempt_board(contract, attempt.status, attempt_moves),
        "pgnDisplay": compute_attempt_pgn(contract, attempt.status, attempt_moves),
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
            .options(selectinload(RunTrainingItem.attempts))
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
        rp_payload = get_content(rp.training_item_id)

        sorted_attempts = sorted(rp.attempts, key=lambda a: a.try_number)
        q_id = qualifying_attempt_id(sorted_attempts, total_queue)

        other_run_puzzles_for_run = list(
            db.session.scalars(
                sa.select(RunTrainingItem)
                .options(selectinload(RunTrainingItem.attempts))
                .where(RunTrainingItem.run_id == other_run.id)
            ).all()
        )

        attempt_views = [
            _overview_attempt_view(
                a, other_run, rp, q_id, total_queue,
                rp_payload.contract,
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
            db.session.scalars(
                sa.select(RunTrainingItem)
                .options(selectinload(RunTrainingItem.attempts))
                .where(RunTrainingItem.run_id == r.id)
            ).all()
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


def _compute_overview_actions(run: Run, metadata: SourceMetadata) -> dict[str, object]:
    next_enabled = run.completed_at is None and run.aborted_at is None
    disabled_reason: str | None = None
    if run.completed_at is not None:
        disabled_reason = "Run complete"
    elif run.aborted_at is not None:
        disabled_reason = "Run aborted"

    if isinstance(metadata, LichessTacticMetadata):
        analyze_url: str | None = metadata.game_url
    elif isinstance(metadata, ScrapedPositionalMetadata):
        analyze_url = metadata.lichess_url
    elif isinstance(metadata, DecoyMetadata):
        analyze_url = metadata.analysis_url
    else:
        analyze_url = None

    return {
        "runStatus": run.status,
        "retake": {"enabled": True},
        "analyze": {"enabled": analyze_url is not None, "url": analyze_url},
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
    tz: str = "UTC",
) -> dict[str, object]:
    payload = get_content(run_puzzle.training_item_id)

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
        db.session.scalars(
            sa.select(RunTrainingItem)
            .options(selectinload(RunTrainingItem.attempts))
            .where(RunTrainingItem.run_id == run.id)
        ).all()
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
            payload.contract, all_run_puzzles, training_id,
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

    target_min_solve_tenths: int | None = (
        run.target_min_solve_seconds * 10 if run.target_min_solve_seconds is not None else None
    )
    target_max_solve_tenths: int | None = (
        run.target_max_solve_seconds * 10 if run.target_max_solve_seconds is not None else None
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
            "fen": payload.contract.fen,
            "solution": payload.contract.plies,
            "source": payload.metadata.to_api_dict(),
        },
        "selectedAttemptId": resolved_selected_id,
        "attempts": attempt_views,
        "sameTrainingItemAcrossRuns": _same_puzzle_run_overview_items(
            run_puzzle, training_id, total_queue
        ),
        "runPace": {
            "chartData": _pace_chart_data(run, all_run_puzzles, config, tz),
        },
        "stats": {
            "runIndex": run.run_index,
            "accuracy": stats["accuracy"],
            "averageSolveTime": stats["averageSolveTime"],
        },
        "progress": _compute_progress_card(
            run, all_run_puzzles, total_queue, run_progress_delta_pct, training_id
        ),
        "actions": _compute_overview_actions(run, payload.metadata),
        "timer": {
            "targetMinSolveTenths": target_min_solve_tenths,
            "targetMaxSolveTenths": target_max_solve_tenths,
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
    tz: str = "UTC",
) -> dict[str, object]:
    run = _get_owned_run(run_id, user_id)
    run_puzzle = db.session.get(RunTrainingItem, run_puzzle_id)
    if run_puzzle is None or run_puzzle.run_id != run.id:
        raise NotFoundError("Puzzle not found", "The requested puzzle could not be found in this run.")
    overview = _build_run_puzzle_overview(
        run, run_puzzle, selected_attempt_id, run.training_id, tz=tz
    )
    return {
        "overview": overview,
        "selectedAttemptId": overview["selectedAttemptId"],
    }


def start_puzzle(run_id: int, run_puzzle_id: int, user_id: int) -> dict[str, object]:
    run = _get_owned_run(run_id, user_id)
    run_puzzle = db.session.get(RunTrainingItem, run_puzzle_id)
    if run_puzzle is None or run_puzzle.run_id != run.id:
        raise NotFoundError("Puzzle not found", "The requested puzzle could not be found in this run.")

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
    tz: str = "UTC",
) -> dict[str, object]:
    attempt, run_puzzle, run = _get_owned_attempt(attempt_id, user_id)

    if run.id != run_id or run_puzzle.id != run_puzzle_id:
        raise NotFoundError("Attempt not found", "The requested attempt does not exist.")

    if attempt.status != "in_progress":
        raise ConflictError("Attempt already completed", "This attempt has already been submitted.")

    _, config = _get_schedule_config(run)
    total_queue = config.total_queue
    is_queue_attempt = attempt.try_number <= total_queue

    payload = get_content(run_puzzle.training_item_id)

    outcome = derive_attempt_outcome(payload.contract, uci_moves)

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
        tz=tz,
    )

    return {
        "completedAttemptId": attempt_id,
        "outcome": outcome,
        "runCompletedByThisAttempt": run_just_completed,
        "overview": overview,
    }


def get_training_item_history(run_id: int, training_item_id: int, user_id: int) -> dict[str, object]:
    run = _get_owned_run(run_id, user_id)
    payload = get_content(training_item_id)

    _, config = _get_schedule_config(run)
    total_queue = config.total_queue

    run_training_items = list(
        db.session.scalars(
            sa.select(RunTrainingItem)
            .options(selectinload(RunTrainingItem.attempts))
            .where(
                RunTrainingItem.run_id == run_id,
                RunTrainingItem.training_item_id == training_item_id,
            )
            .order_by(RunTrainingItem.position)
        ).all()
    )
    if not run_training_items:
        raise NotFoundError("Puzzle not found", "The requested puzzle could not be found in this run.")

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
        "source": payload.metadata.to_api_dict(),
        "solution": payload.contract.plies,
        "maxTriesPerItem": total_queue,
        "positions": positions,
    }


def get_attempt(
    run_id: int, run_puzzle_id: int, attempt_id: int, user_id: int, tz: str = "UTC"
) -> dict[str, object]:
    run = _get_owned_run(run_id, user_id)
    run_puzzle = db.session.get(RunTrainingItem, run_puzzle_id)
    if run_puzzle is None or run_puzzle.run_id != run.id:
        raise NotFoundError("Puzzle not found", "The requested puzzle could not be found in this run.")
    attempt = db.session.get(TrainingAttempt, attempt_id)
    if attempt is None or attempt.run_training_item_id != run_puzzle.id:
        raise NotFoundError("Attempt not found", "The requested attempt does not exist.")

    if attempt.status == "in_progress":
        return {
            "kind": "active_attempt",
            "attemptView": _run_puzzle_attempt_view_dict(run_puzzle),
        }

    overview_url = (
        f"/app/runs/{run_id}/training-items/{run_puzzle_id}/overview?attempt={attempt_id}"
    )
    overview = _build_run_puzzle_overview(
        run, run_puzzle, attempt_id, run.training_id, tz=tz
    )
    return {
        "kind": "completed_attempt",
        "overviewUrl": overview_url,
        "overview": overview,
    }
