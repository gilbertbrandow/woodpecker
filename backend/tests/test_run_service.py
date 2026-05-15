import pytest
from app.models.run import TrainingAttempt
from app.services.attempt_state import attempt_type_fields
from app.services.run import _total_queue_attempts


def _make_attempt(try_number: int, status: str) -> TrainingAttempt:
    a = TrainingAttempt()
    a.try_number = try_number
    a.status = status
    return a



@pytest.mark.parametrize(
    "config, expected",
    [
        ({}, 1),
        ({"failed_repetition": {"mode": "single"}}, 1),
        ({"failed_repetition": {"mode": "queue", "max_repeats": 0}}, 1),
        ({"failed_repetition": {"mode": "queue", "max_repeats": 2}}, 3),
        ({"failed_repetition": "not_a_dict"}, 1),
    ],
)
def test_total_queue_attempts(config: dict[str, object], expected: int) -> None:
    assert _total_queue_attempts(config) == expected


def test_attempt_type_fields_first_attempt_scored() -> None:
    result = attempt_type_fields([], 1, 1)
    assert result["attemptType"] == "scored"
    assert result["countsTowardsTraining"] is True
    assert result["countsTowardsProgress"] is True
    assert result["countsTowardsAccuracy"] is True
    assert result["countsTowardsAverageTime"] is True


def test_attempt_type_fields_second_attempt_scored() -> None:
    prior_failed = _make_attempt(1, "failed")
    result = attempt_type_fields([prior_failed], 2, 2)
    assert result["attemptType"] == "scored"
    assert result["countsTowardsTraining"] is True


def test_attempt_type_fields_beyond_queue() -> None:
    result = attempt_type_fields([], 3, 2)
    assert result["attemptType"] == "practice"
    assert result["countsTowardsTraining"] is False
    assert result["countsTowardsProgress"] is False
    assert result["countsTowardsAccuracy"] is False
    assert result["countsTowardsAverageTime"] is False


def test_attempt_type_fields_already_solved() -> None:
    prior_solved = _make_attempt(1, "solved")
    result = attempt_type_fields([prior_solved], 2, 2)
    assert result["attemptType"] == "practice"
    assert result["countsTowardsTraining"] is False
