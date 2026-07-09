import pytest
from typing import cast
from tests.conftest import _seed_world  # type: ignore[import]
from app.exceptions import ValidationError


def _get_training_id(db_session, run_id: int) -> int:
    from app.models.run import Run
    run = db_session.get(Run, run_id)
    assert run is not None
    return run.training_id


def test_set_run_target_max_only(db_session) -> None:  # type: ignore[misc]
    world = _seed_world(db_session)
    from app.services import training as svc

    run = svc.set_run_target(
        _get_training_id(db_session, cast(int, world["run_id"])),
        cast(int, world["user_id"]),
        0,
        None,
        None,
        30,
    )
    assert run.target_max_solve_seconds == 30
    assert run.target_min_solve_seconds is None


def test_set_run_target_min_and_max(db_session) -> None:  # type: ignore[misc]
    world = _seed_world(db_session)
    from app.services import training as svc

    run = svc.set_run_target(
        _get_training_id(db_session, cast(int, world["run_id"])),
        cast(int, world["user_id"]),
        0,
        None,
        10,
        30,
    )
    assert run.target_min_solve_seconds == 10
    assert run.target_max_solve_seconds == 30


def test_set_run_target_max_too_small(db_session) -> None:  # type: ignore[misc]
    world = _seed_world(db_session)
    from app.services import training as svc

    with pytest.raises(ValidationError):
        svc.set_run_target(
            _get_training_id(db_session, cast(int, world["run_id"])),
            cast(int, world["user_id"]),
            0,
            None,
            None,
            0,
        )


def test_set_run_target_min_without_max(db_session) -> None:  # type: ignore[misc]
    world = _seed_world(db_session)
    from app.services import training as svc

    with pytest.raises(ValidationError, match="minimum solve time requires a maximum"):
        svc.set_run_target(
            _get_training_id(db_session, cast(int, world["run_id"])),
            cast(int, world["user_id"]),
            0,
            None,
            10,
            None,
        )


def test_set_run_target_min_too_small(db_session) -> None:  # type: ignore[misc]
    world = _seed_world(db_session)
    from app.services import training as svc

    with pytest.raises(ValidationError, match="minimum solve time must be at least"):
        svc.set_run_target(
            _get_training_id(db_session, cast(int, world["run_id"])),
            cast(int, world["user_id"]),
            0,
            None,
            0,
            30,
        )


def test_set_run_target_min_equals_max(db_session) -> None:  # type: ignore[misc]
    world = _seed_world(db_session)
    from app.services import training as svc

    with pytest.raises(ValidationError, match="minimum solve time must be less than"):
        svc.set_run_target(
            _get_training_id(db_session, cast(int, world["run_id"])),
            cast(int, world["user_id"]),
            0,
            None,
            30,
            30,
        )


def test_set_run_target_min_greater_than_max(db_session) -> None:  # type: ignore[misc]
    world = _seed_world(db_session)
    from app.services import training as svc

    with pytest.raises(ValidationError, match="minimum solve time must be less than"):
        svc.set_run_target(
            _get_training_id(db_session, cast(int, world["run_id"])),
            cast(int, world["user_id"]),
            0,
            None,
            60,
            30,
        )
