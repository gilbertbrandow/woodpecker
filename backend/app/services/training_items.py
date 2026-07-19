from datetime import datetime
from typing import cast

import sqlalchemy as sa

from app.extensions import db
from app.exceptions import ForbiddenError, NotFoundError
from app.table_query import FilterList, RangeFilter
from app.models.run import TrainingAttempt, Run, RunTrainingItem
from app.models.training import Training
from app.models.user import User
from app.models.schedule import Schedule
from app.models.subset import Subset
from app.services.attempt_state import attempt_type_fields
from app.services.chess_board import compute_attempt_board, compute_attempt_pgn
from app.services.schedule_config import ScheduleConfig
from app.services.training_item_content import get_content


def _range_matches(f: RangeFilter, value: float | None) -> bool:
    if not f.is_set:
        return True
    if f.op == 'set':
        return value is not None
    if f.op == 'not_set':
        return value is None
    if value is None or f.from_val is None:
        return False
    if f.op == 'is':
        return value == f.from_val
    if f.op == 'is_not':
        return value != f.from_val
    if f.op == 'gt':
        return value > f.from_val
    if f.op == 'gte':
        return value >= f.from_val
    if f.op == 'lt':
        return value < f.from_val
    if f.op == 'lte':
        return value <= f.from_val
    if f.op in ('between', 'not_between') and f.to_val is not None:
        inside = f.from_val <= value <= f.to_val
        return not inside if f.op == 'not_between' else inside
    return True


def _require_own_attempt(training_item_id: int, user_id: int) -> None:
    exists = db.session.scalar(
        sa.select(sa.literal(1))
        .select_from(TrainingAttempt)
        .join(RunTrainingItem, TrainingAttempt.run_training_item_id == RunTrainingItem.id)
        .join(Run, RunTrainingItem.run_id == Run.id)
        .join(Training, Run.training_id == Training.id)
        .where(
            RunTrainingItem.training_item_id == training_item_id,
            Training.user_id == user_id,
            TrainingAttempt.status != "in_progress",
        )
        .limit(1)
    )
    if exists is None:
        raise ForbiddenError(
            "Access denied",
            "You must have attempted this puzzle yourself to access this data.",
        )


def get_attempt_history(
    training_item_id: int,
    user_id: int,
    page: int = 1,
    page_size: int = 20,
    user_ids: FilterList | None = None,
    result: FilterList | None = None,
    schedule_ids: FilterList | None = None,
    subset_ids: FilterList | None = None,
    run_number: RangeFilter | None = None,
    try_number: RangeFilter | None = None,
    time_spent_ms: RangeFilter | None = None,
) -> dict[str, object]:
    _require_own_attempt(training_item_id, user_id)

    # Single join query — replaces N×4 individual session.get() calls.
    context_stmt = (
        sa.select(RunTrainingItem, Run, Training, User, Schedule, Subset)
        .join(Run, RunTrainingItem.run_id == Run.id)
        .join(Training, Run.training_id == Training.id)
        .join(User, Training.user_id == User.id)
        .join(Schedule, Training.schedule_id == Schedule.id)
        .join(Subset, Schedule.subset_id == Subset.id)
        .where(RunTrainingItem.training_item_id == training_item_id)
    )
    if user_ids is not None:
        context_stmt = user_ids.apply_orm(context_stmt, Training.user_id)
    if schedule_ids is not None:
        context_stmt = schedule_ids.apply_orm(context_stmt, Schedule.id)
    if subset_ids is not None:
        context_stmt = subset_ids.apply_orm(context_stmt, Subset.id)

    context_rows = db.session.execute(context_stmt).all()
    if not context_rows:
        return {"attempts": [], "total": 0}

    # Batch-load all non-in-progress attempts for the matched RunTrainingItems.
    # Load without result_filter here: attempt_type_fields needs the full attempt
    # list as context to compute countsTowardsTraining correctly.
    rp_ids = [row.RunTrainingItem.id for row in context_rows]
    all_attempts = db.session.scalars(
        sa.select(TrainingAttempt)
        .where(
            TrainingAttempt.run_training_item_id.in_(rp_ids),
            TrainingAttempt.status != "in_progress",
        )
    ).all()
    attempts_by_rp: dict[int, list[TrainingAttempt]] = {}
    for a in all_attempts:
        attempts_by_rp.setdefault(a.run_training_item_id, []).append(a)

    rows: list[dict[str, object]] = []
    for ctx in context_rows:
        rp, run, training, user, schedule, subset = (
            ctx.RunTrainingItem, ctx.Run, ctx.Training, ctx.User, ctx.Schedule, ctx.Subset
        )
        if not isinstance(schedule.config, dict):
            continue
        config = ScheduleConfig.from_dict(schedule.config)
        total_queue = config.total_queue

        sorted_attempts = sorted(attempts_by_rp.get(rp.id, []), key=lambda a: a.try_number)
        run_num = run.run_index + 1
        for a in sorted_attempts:
            if result is not None and result.str_values:
                matches = a.status in result.str_values
                if result.op == 'is_not':
                    matches = not matches
                if not matches:
                    continue
            if run_number is not None and run_number.is_set and not _range_matches(run_number, run_num):
                continue
            if try_number is not None and try_number.is_set and not _range_matches(try_number, a.try_number):
                continue
            if time_spent_ms is not None and time_spent_ms.is_set and not _range_matches(time_spent_ms, a.time_spent_ms):
                continue
            type_data = attempt_type_fields(sorted_attempts, a.try_number, total_queue)
            rows.append({
                "attemptId": a.id,
                "runId": rp.run_id,
                "runTrainingItemId": rp.id,
                "userId": training.user_id,
                "displayName": user.display_name,
                "avatarUrl": user.avatar_url,
                "runIndex": run.run_index,
                "tryNumber": a.try_number,
                "countsTowardsTraining": type_data["countsTowardsTraining"],
                "result": a.status,
                "timeSpentMs": a.time_spent_ms,
                "scheduleId": schedule.id,
                "scheduleName": schedule.name,
                "subsetId": subset.id,
                "subsetName": subset.name,
                "_started_at": a.started_at,
            })

    rows.sort(key=lambda r: cast(datetime, r["_started_at"]), reverse=True)
    total = len(rows)
    start = (page - 1) * page_size
    page_rows = rows[start : start + page_size]
    for r in page_rows:
        r["startedAt"] = cast(datetime, r.pop("_started_at")).isoformat()
    return {"attempts": page_rows, "total": total}


def get_spectate_view(training_item_id: int, attempt_id: int, user_id: int) -> dict[str, object]:
    _require_own_attempt(training_item_id, user_id)

    attempt = db.session.scalars(
        sa.select(TrainingAttempt)
        .join(RunTrainingItem, TrainingAttempt.run_training_item_id == RunTrainingItem.id)
        .where(
            TrainingAttempt.id == attempt_id,
            RunTrainingItem.training_item_id == training_item_id,
        )
    ).first()
    if attempt is None:
        raise NotFoundError("Attempt not found", "The requested attempt does not exist.")

    if attempt.status == "in_progress":
        raise NotFoundError("Attempt not found", "The requested attempt is still in progress.")

    payload = get_content(training_item_id)
    attempt_moves = attempt.moves if isinstance(attempt.moves, list) else []

    return {
        "attemptId": attempt.id,
        "timeSpentMs": attempt.time_spent_ms,
        "board": compute_attempt_board(payload.contract, attempt.status, attempt_moves),
        "pgnDisplay": compute_attempt_pgn(payload.contract, attempt.status, attempt_moves),
    }
