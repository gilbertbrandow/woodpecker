import pytest
from app.services.run import _total_queue_attempts


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
