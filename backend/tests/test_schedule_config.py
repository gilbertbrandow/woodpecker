import pytest

from app.services.schedule_config import ScheduleConfig

VALID = {
    "runs": [{"target_hours": 24, "break_after_hours": 0}],
    "puzzle_order": "random",
    "failed_repetition": {"mode": "none"},
}


def _with(**overrides: object) -> dict[str, object]:
    return {**VALID, **overrides}


def test_valid_config_parses() -> None:
    cfg = ScheduleConfig.from_dict(VALID)
    assert len(cfg.runs) == 1
    assert cfg.runs[0].target_hours == 24
    assert cfg.runs[0].break_after_hours == 0
    assert cfg.puzzle_order == "random"
    assert cfg.total_queue == 1


def test_total_hours_sums_all_runs() -> None:
    cfg = ScheduleConfig.from_dict({
        "runs": [
            {"target_hours": 168, "break_after_hours": 48},
            {"target_hours": 24, "break_after_hours": 0},
        ],
        "puzzle_order": "random",
        "failed_repetition": {"mode": "none"},
    })
    assert cfg.total_hours == 168 + 48 + 24 + 0


def test_queue_mode_sets_total_queue() -> None:
    cfg = ScheduleConfig.from_dict(_with(failed_repetition={"mode": "queue", "max_repeats": 2}))
    assert cfg.total_queue == 3


def test_none_mode_gives_total_queue_1() -> None:
    cfg = ScheduleConfig.from_dict(_with(failed_repetition={"mode": "none"}))
    assert cfg.total_queue == 1


@pytest.mark.parametrize("order", ["random", "fixed", "rating_asc", "rating_desc"])
def test_all_valid_puzzle_orders(order: str) -> None:
    cfg = ScheduleConfig.from_dict(_with(puzzle_order=order))
    assert cfg.puzzle_order == order


def test_missing_runs_raises() -> None:
    with pytest.raises(ValueError, match="config.runs must be a list"):
        ScheduleConfig.from_dict(_with(runs=None))


def test_empty_runs_raises() -> None:
    with pytest.raises(ValueError, match="at least one entry"):
        ScheduleConfig.from_dict(_with(runs=[]))


def test_zero_target_hours_raises() -> None:
    with pytest.raises(ValueError, match="target_hours must be a positive integer"):
        ScheduleConfig.from_dict(_with(runs=[{"target_hours": 0, "break_after_hours": 0}]))


def test_negative_target_hours_raises() -> None:
    with pytest.raises(ValueError, match="target_hours must be a positive integer"):
        ScheduleConfig.from_dict(_with(runs=[{"target_hours": -1, "break_after_hours": 0}]))


def test_negative_break_hours_raises() -> None:
    with pytest.raises(ValueError, match="break_after_hours must be a non-negative integer"):
        ScheduleConfig.from_dict(_with(runs=[{"target_hours": 24, "break_after_hours": -1}]))


def test_invalid_puzzle_order_raises() -> None:
    with pytest.raises(ValueError, match="config.puzzle_order must be one of"):
        ScheduleConfig.from_dict(_with(puzzle_order="shuffle"))


def test_missing_failed_repetition_raises() -> None:
    with pytest.raises(ValueError, match="config.failed_repetition must be an object"):
        ScheduleConfig.from_dict(_with(failed_repetition=None))


def test_invalid_rep_mode_raises() -> None:
    with pytest.raises(ValueError, match="config.failed_repetition.mode"):
        ScheduleConfig.from_dict(_with(failed_repetition={"mode": "always"}))


def test_queue_mode_without_max_repeats_raises() -> None:
    with pytest.raises(ValueError, match="max_repeats"):
        ScheduleConfig.from_dict(_with(failed_repetition={"mode": "queue"}))


def test_queue_mode_zero_max_repeats_raises() -> None:
    with pytest.raises(ValueError, match="max_repeats"):
        ScheduleConfig.from_dict(_with(failed_repetition={"mode": "queue", "max_repeats": 0}))
