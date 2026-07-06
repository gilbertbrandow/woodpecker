from datetime import datetime
from typing import cast

import sqlalchemy as sa

from app.extensions import db
from app.exceptions import ForbiddenError, NotFoundError
from app.models.run import TrainingAttempt, Run, RunTrainingItem
from app.models.training import Training
from app.models.user import User
from app.models.schedule import Schedule
from app.services.attempt_state import attempt_type_fields
from app.services.chess_board import compute_attempt_board, compute_attempt_pgn
from app.services.schedule_config import ScheduleConfig
from app.services.training_item_content import get_content


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
    user_ids: list[int] | None = None,
    result_filter: list[str] | None = None,
) -> dict[str, object]:
    _require_own_attempt(training_item_id, user_id)

    # Single join query — replaces N×4 individual session.get() calls.
    context_stmt = (
        sa.select(RunTrainingItem, Run, Training, User, Schedule)
        .join(Run, RunTrainingItem.run_id == Run.id)
        .join(Training, Run.training_id == Training.id)
        .join(User, Training.user_id == User.id)
        .join(Schedule, Training.schedule_id == Schedule.id)
        .where(RunTrainingItem.training_item_id == training_item_id)
    )
    if user_ids:
        context_stmt = context_stmt.where(Training.user_id.in_(user_ids))

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
        rp, run, training, user, schedule = (
            ctx.RunTrainingItem, ctx.Run, ctx.Training, ctx.User, ctx.Schedule
        )
        if not isinstance(schedule.config, dict):
            continue
        config = ScheduleConfig.from_dict(schedule.config)
        total_queue = config.total_queue

        sorted_attempts = sorted(attempts_by_rp.get(rp.id, []), key=lambda a: a.try_number)
        for a in sorted_attempts:
            if result_filter and a.status not in result_filter:
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
