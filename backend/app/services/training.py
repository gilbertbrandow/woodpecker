from datetime import datetime, timezone
from typing import cast

import sqlalchemy as sa

from app.extensions import db
from app.models.puzzle import Puzzle
from app.models.run import PuzzleAttempt, Run, RunPuzzle
from app.models.schedule import Schedule
from app.models.training import Training
from app.models.subset import Subset
from app.models.user import User


def _compute_total_hours(config: dict[str, object]) -> int:
    runs_raw = config.get("runs")
    if not isinstance(runs_raw, list):
        return 0
    total = 0
    for run_item in runs_raw:
        if not isinstance(run_item, dict):
            continue
        run = cast(dict[str, object], run_item)
        target = run.get("target_hours")
        break_after = run.get("break_after_hours")
        total += (target if isinstance(target, int) else 0) + (
            break_after if isinstance(break_after, int) else 0
        )
    return total


def _get_owned_training(training_id: int, user_id: int) -> Training:
    training = db.session.get(Training, training_id)
    if training is None:
        raise LookupError("Training not found.")
    if training.user_id != user_id:
        raise PermissionError("Access denied.")
    return training


def training_full_dict(training: Training) -> dict[str, object]:
    schedule = db.session.get(Schedule, training.schedule_id)
    if schedule is None:
        raise LookupError("Schedule not found.")
    subset = db.session.get(Subset, schedule.subset_id)
    if subset is None:
        raise LookupError("Subset not found.")
    creator = db.session.get(User, schedule.user_id)
    if creator is None:
        raise LookupError("Schedule creator not found.")
    owner = db.session.get(User, training.user_id)
    if owner is None:
        raise LookupError("Training owner not found.")

    config = schedule.config if isinstance(schedule.config, dict) else {}
    runs_raw = config.get("runs")
    run_count = len(runs_raw) if isinstance(runs_raw, list) else 0
    order_raw = config.get("puzzle_order")
    puzzle_order = order_raw if isinstance(order_raw, str) else None
    total_hours = _compute_total_hours(config)

    puzzle_count = (
        subset.locked_puzzle_count
        if subset.locked_puzzle_count is not None
        else subset.puzzle_count
    ) or 0

    runs = db.session.scalars(
        sa.select(Run)
        .where(Run.training_id == training.id)
        .order_by(Run.run_index)
    ).all()
    run_targets: list[dict[str, object]] = [
        {
            "runIndex": r.run_index,
            "targetAccuracy": r.target_accuracy,
            "targetSolveSeconds": r.target_solve_seconds,
        }
        for r in runs
        if r.target_accuracy is not None or r.target_solve_seconds is not None
    ]

    return {
        "id": training.id,
        "scheduleId": training.schedule_id,
        "status": training_status(training),
        "startedAt": training.started_at.isoformat(),
        "completedAt": training.completed_at.isoformat() if training.completed_at else None,
        "abortedAt": training.aborted_at.isoformat() if training.aborted_at else None,
        "ownerUsername": owner.lichess_username,
        "ownerAvatarUrl": owner.avatar_url,
        "runTargets": run_targets,
        "schedule": {
            "id": schedule.id,
            "name": schedule.name,
            "description": schedule.description,
            "status": schedule.status,
            "totalHours": total_hours,
            "runCount": run_count,
            "runs": runs_raw if isinstance(runs_raw, list) else [],
            "puzzleOrder": puzzle_order,
            "createdBy": {
                "username": creator.lichess_username,
                "avatarUrl": creator.avatar_url,
            },
            "subset": {
                "id": subset.id,
                "name": subset.name,
                "puzzleCount": puzzle_count,
            },
        },
    }


def get_cross_run_puzzle_refs(
    training_id: int,
    puzzle_id: str,
    user_id: int,
) -> list[dict[str, object]]:
    _get_owned_training(training_id, user_id)

    rows = db.session.execute(
        sa.select(
            RunPuzzle.id.label("run_puzzle_id"),
            Run.id.label("run_id"),
            Run.run_index,
            sa.exists()
            .where(PuzzleAttempt.run_puzzle_id == RunPuzzle.id)
            .label("has_attempts"),
        )
        .join(Run, Run.id == RunPuzzle.run_id)
        .join(Puzzle, Puzzle.id == RunPuzzle.puzzle_id)
        .where(
            Run.training_id == training_id,
            Puzzle.puzzle_id == puzzle_id,
        )
        .order_by(Run.run_index)
    ).all()

    return [
        {
            "runId": int(row.run_id),
            "runIndex": int(row.run_index),
            "runPuzzleId": int(row.run_puzzle_id),
            "hasAttempts": bool(row.has_attempts),
        }
        for row in rows
    ]


def create_training(user_id: int, schedule_id: int) -> Training:
    schedule = db.session.get(Schedule, schedule_id)
    if schedule is None:
        raise LookupError("Schedule not found.")
    if schedule.locked_at is None:
        raise ValueError("Schedule must be locked before enrolling.")

    existing = db.session.scalar(
        sa.select(Training).where(
            Training.schedule_id == schedule_id,
            Training.user_id == user_id,
        )
    )
    if existing is not None:
        raise ValueError("Already enrolled in this schedule.")

    training = Training(
        user_id=user_id,
        schedule_id=schedule_id,
    )
    db.session.add(training)
    db.session.commit()
    return training


def get_training(training_id: int) -> Training:
    training = db.session.get(Training, training_id)
    if training is None:
        raise LookupError("Training not found.")
    return training


def list_my_trainings(user_id: int) -> list[dict[str, object]]:
    rows = db.session.execute(
        sa.text("""
            SELECT t.id, t.schedule_id,
                   t.started_at, t.completed_at, t.aborted_at,
                   s.name AS schedule_name, s.subset_id, s.config,
                   CASE
                     WHEN t.aborted_at IS NOT NULL THEN 'aborted'
                     WHEN t.completed_at IS NOT NULL THEN 'completed'
                     WHEN EXISTS (SELECT 1 FROM runs r WHERE r.training_id = t.id) THEN 'in_progress'
                     ELSE 'draft'
                   END AS status,
                   (
                       SELECT COUNT(*)
                       FROM subset_puzzles sp
                       WHERE sp.subset_id = s.subset_id
                   ) AS subset_puzzle_count,
                   (
                       SELECT COUNT(rp.id)
                       FROM runs r
                       JOIN run_puzzles rp ON rp.run_id = r.id
                       WHERE r.training_id = t.id
                         AND EXISTS (
                             SELECT 1 FROM puzzle_attempts pa
                             WHERE pa.run_puzzle_id = rp.id
                         )
                         AND NOT EXISTS (
                             SELECT 1 FROM puzzle_attempts pa
                             WHERE pa.run_puzzle_id = rp.id
                               AND pa.status = 'in_progress'
                         )
                   ) AS completed_puzzles
            FROM trainings t
            JOIN schedules s ON s.id = t.schedule_id
            WHERE t.user_id = :uid
            ORDER BY t.started_at DESC
        """),
        {"uid": user_id},
    ).all()

    result: list[dict[str, object]] = []
    for row in rows:
        config: dict[str, object] = row.config if isinstance(row.config, dict) else {}
        runs_raw = config.get("runs")
        total_runs = len(runs_raw) if isinstance(runs_raw, list) else 0
        result.append({
            "id": row.id,
            "scheduleId": row.schedule_id,
            "scheduleName": row.schedule_name,
            "subsetId": row.subset_id,
            "status": row.status,
            "totalRuns": total_runs,
            "completedPuzzles": row.completed_puzzles,
            "totalPuzzles": row.subset_puzzle_count * total_runs,
            "startedAt": row.started_at.isoformat(),
            "completedAt": row.completed_at.isoformat() if row.completed_at else None,
            "abortedAt": row.aborted_at.isoformat() if row.aborted_at else None,
        })
    return result


def set_run_target(
    training_id: int,
    user_id: int,
    run_index: int,
    target_accuracy: float | None,
    target_solve_seconds: int | None,
) -> Run:
    _get_owned_training(training_id, user_id)

    if target_accuracy is not None and not (0.0 <= target_accuracy <= 100.0):
        raise ValueError("targetAccuracy must be between 0 and 100.")
    if target_solve_seconds is not None and target_solve_seconds < 1:
        raise ValueError("targetSolveSeconds must be at least 1.")

    run = db.session.scalar(
        sa.select(Run).where(
            Run.training_id == training_id,
            Run.run_index == run_index,
        )
    )
    if run is None:
        raise LookupError("Run not found.")
    run.target_accuracy = target_accuracy
    run.target_solve_seconds = target_solve_seconds
    db.session.commit()
    return run


def abort_training(training_id: int, user_id: int) -> Training:
    training = _get_owned_training(training_id, user_id)
    if training.completed_at is not None or training.aborted_at is not None:
        raise ValueError("Training is already terminal.")
    training.aborted_at = datetime.now(timezone.utc)
    db.session.commit()
    return training


def list_all_trainings(schedule_id: int | None = None) -> list[dict[str, object]]:
    where = "WHERE t.schedule_id = :sid" if schedule_id is not None else ""
    rows = db.session.execute(
        sa.text(f"""
            SELECT t.id, t.schedule_id,
                   t.started_at, t.completed_at, t.aborted_at,
                   s.name AS schedule_name, s.subset_id, s.config,
                   u.lichess_username, u.avatar_url,
                   CASE
                     WHEN t.aborted_at IS NOT NULL THEN 'aborted'
                     WHEN t.completed_at IS NOT NULL THEN 'completed'
                     WHEN EXISTS (SELECT 1 FROM runs r WHERE r.training_id = t.id) THEN 'in_progress'
                     ELSE 'draft'
                   END AS status,
                   (
                       SELECT COUNT(*)
                       FROM subset_puzzles sp
                       WHERE sp.subset_id = s.subset_id
                   ) AS subset_puzzle_count,
                   (
                       SELECT COUNT(rp.id)
                       FROM runs r
                       JOIN run_puzzles rp ON rp.run_id = r.id
                       WHERE r.training_id = t.id
                         AND EXISTS (
                             SELECT 1 FROM puzzle_attempts pa
                             WHERE pa.run_puzzle_id = rp.id
                         )
                         AND NOT EXISTS (
                             SELECT 1 FROM puzzle_attempts pa
                             WHERE pa.run_puzzle_id = rp.id
                               AND pa.status = 'in_progress'
                         )
                   ) AS completed_puzzles
            FROM trainings t
            JOIN schedules s ON s.id = t.schedule_id
            JOIN users u ON u.id = t.user_id
            {where}
            ORDER BY t.started_at DESC
        """),
        {"sid": schedule_id} if schedule_id is not None else {},
    ).all()

    result: list[dict[str, object]] = []
    for row in rows:
        config: dict[str, object] = row.config if isinstance(row.config, dict) else {}
        runs_raw = config.get("runs")
        total_runs = len(runs_raw) if isinstance(runs_raw, list) else 0
        result.append({
            "id": row.id,
            "scheduleId": row.schedule_id,
            "scheduleName": row.schedule_name,
            "subsetId": row.subset_id,
            "status": row.status,
            "totalRuns": total_runs,
            "completedPuzzles": row.completed_puzzles,
            "totalPuzzles": row.subset_puzzle_count * total_runs,
            "startedAt": row.started_at.isoformat(),
            "completedAt": row.completed_at.isoformat() if row.completed_at else None,
            "abortedAt": row.aborted_at.isoformat() if row.aborted_at else None,
            "user": {
                "username": row.lichess_username,
                "avatarUrl": row.avatar_url,
            },
        })
    return result


def training_status(training: Training) -> str:
    if training.aborted_at is not None:
        return "aborted"
    if training.completed_at is not None:
        return "completed"
    run_count = db.session.scalar(
        sa.select(sa.func.count()).where(Run.training_id == training.id)
    ) or 0
    return "in_progress" if run_count > 0 else "draft"


def get_my_training_for_schedule(
    schedule_id: int, user_id: int
) -> Training | None:
    return db.session.scalar(
        sa.select(Training).where(
            Training.schedule_id == schedule_id,
            Training.user_id == user_id,
        )
    )


def get_schedule_participants(
    schedule_id: int, user_id: int
) -> dict[str, object]:
    my_training = get_my_training_for_schedule(schedule_id, user_id)
    if my_training is None:
        raise PermissionError("You are not enrolled in this schedule.")

    rows = db.session.execute(
        sa.text("""
            SELECT t.id, t.started_at, u.lichess_username, u.avatar_url
            FROM trainings t
            JOIN users u ON u.id = t.user_id
            WHERE t.schedule_id = :sid
            ORDER BY t.started_at ASC
        """),
        {"sid": schedule_id},
    ).all()

    participants: list[dict[str, object]] = [
        {
            "id": row.id,
            "username": row.lichess_username,
            "avatarUrl": row.avatar_url,
            "startedAt": row.started_at.isoformat(),
        }
        for row in rows
    ]
    return {"count": len(participants), "participants": participants}


def get_training_insights(
    schedule_id: int,
    user_id: int,
    run_indices: list[int],
    participant_ids: list[int],
) -> dict[str, object]:
    my_training = get_my_training_for_schedule(schedule_id, user_id)
    if my_training is None:
        raise PermissionError("You are not enrolled in this schedule.")

    if participant_ids:
        enrolled_ids = list(
            db.session.scalars(
                sa.select(Training.id).where(
                    Training.id.in_(participant_ids),
                    Training.schedule_id == schedule_id,
                )
            ).all()
        )
        if len(enrolled_ids) != len(set(participant_ids)):
            raise ValueError("Some participant ids do not belong to this schedule.")

    return {"datapoints": []}


def get_training_run_solve_times(training_id: int) -> list[dict[str, object]]:
    training = db.session.get(Training, training_id)
    if training is None:
        raise LookupError("Training not found.")

    rows = db.session.execute(
        sa.text("""
            SELECT
                r.run_index,
                AVG(last_attempt.time_spent_ms) AS avg_solve_time_ms
            FROM runs r
            JOIN run_puzzles rp ON rp.run_id = r.id
            JOIN LATERAL (
                SELECT pa.time_spent_ms
                FROM puzzle_attempts pa
                WHERE pa.run_puzzle_id = rp.id
                  AND pa.status != 'in_progress'
                ORDER BY pa.try_number DESC
                LIMIT 1
            ) last_attempt ON last_attempt.time_spent_ms IS NOT NULL
            WHERE r.training_id = :training_id
              AND r.aborted_at IS NULL
            GROUP BY r.id, r.run_index
            ORDER BY r.run_index
        """),
        {"training_id": training_id},
    ).all()

    return [
        {
            "runIndex": int(row.run_index),
            "avgSolveTimeMs": float(row.avg_solve_time_ms) if row.avg_solve_time_ms is not None else None,
        }
        for row in rows
    ]
