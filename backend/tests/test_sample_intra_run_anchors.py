"""Unit tests for _sample_intra_run_anchors."""

from app.services.training import _sample_intra_run_anchors


class TestSampleIntraRunAnchors:
    def test_empty_returns_empty(self) -> None:
        assert _sample_intra_run_anchors([], 10) == []

    def test_total_less_than_n_returns_all(self) -> None:
        times = [100, 200, 300]
        result = _sample_intra_run_anchors(times, 10)
        assert result == [(100, 1), (200, 2), (300, 3)]

    def test_total_equal_to_n_returns_all(self) -> None:
        times = list(range(100, 1100, 100))  # 10 items
        result = _sample_intra_run_anchors(times, 10)
        assert len(result) == 10
        assert result == [(t, i + 1) for i, t in enumerate(times)]

    def test_total_greater_than_n_returns_exactly_n(self) -> None:
        times = list(range(1, 201))  # 200 items
        result = _sample_intra_run_anchors(times, 10)
        assert len(result) == 10

    def test_last_entry_is_always_final_element(self) -> None:
        for total in [11, 15, 20, 25, 99, 200]:
            times = list(range(total))
            result = _sample_intra_run_anchors(times, 10)
            assert result[-1] == (times[-1], total), f"failed for total={total}"

    def test_puzzle_indices_are_1_based_and_ascending(self) -> None:
        times = list(range(200))
        result = _sample_intra_run_anchors(times, 10)
        indices = [idx for _, idx in result]
        assert indices == sorted(indices)
        assert indices[0] >= 1
        assert indices[-1] == 200

    def test_evenly_spaced_sampling(self) -> None:
        # 200 items, n=10: step=20, picks every 20th (1-based: 20, 40, …, 200)
        times = list(range(200))
        result = _sample_intra_run_anchors(times, 10)
        expected_indices = [20, 40, 60, 80, 100, 120, 140, 160, 180, 200]
        assert [idx for _, idx in result] == expected_indices

    def test_timestamps_match_times_ms_at_sampled_positions(self) -> None:
        times = [i * 1000 for i in range(1, 201)]  # 1000, 2000, ..., 200000
        result = _sample_intra_run_anchors(times, 10)
        for t, puzzle_idx in result:
            assert times[puzzle_idx - 1] == t
