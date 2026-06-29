"""Tests for multi-source Subset sampling, config validation, and migration.

Issue #117.

The TestDiscardByTrainingItemId and TestGetStatsPerSource classes test the
*target* behavior of endpoints that have not been updated yet — they will
be red until those endpoints are implemented.
"""
from datetime import datetime, timezone

import pytest
import sqlalchemy as sa
from flask.testing import FlaskClient


# ── Helpers ──────────────────────────────────────────────────────────────────────

def _login(client: FlaskClient, user_id: int) -> None:
    with client.session_transaction() as sess:
        sess["user_id"] = user_id


def _make_user(session, username: str = "subset_test_user"):  # type: ignore[misc]
    from app.models.user import User
    user = User(
        lichess_username=username,
        display_name=username,
        created_at=datetime.now(timezone.utc),
    )
    session.add(user)
    session.flush()
    return user


def _get_or_create_difficulty(session, value: int, label: str = "Test"):  # type: ignore[misc]
    from app.models.scraped_positional_difficulty import ScrapedPositionalDifficulty
    existing = session.execute(
        sa.select(ScrapedPositionalDifficulty).where(ScrapedPositionalDifficulty.value == value)
    ).scalar_one_or_none()
    if existing:
        return existing
    d = ScrapedPositionalDifficulty(value=value, label=label, description=f"Difficulty {value}")
    session.add(d)
    session.flush()
    return d


def _get_or_create_theme(session, name: str, display_name: str | None = None):  # type: ignore[misc]
    from app.models.scraped_positional_theme import ScrapedPositionalTheme
    existing = session.execute(
        sa.select(ScrapedPositionalTheme).where(ScrapedPositionalTheme.name == name)
    ).scalar_one_or_none()
    if existing:
        return existing
    t = ScrapedPositionalTheme(
        name=name, display_name=display_name or name, description=f"Theme {name}"
    )
    session.add(t)
    session.flush()
    return t


def _make_tactic(session, puzzle_id: str, rating: int = 1500):  # type: ignore[misc]
    from app.models.training_item import TrainingItem, TrainingItemSource
    from app.models.lichess_tactic import LichessTactic
    item = TrainingItem(source_type=TrainingItemSource.LICHESS_TACTIC)
    session.add(item)
    session.flush()
    tactic = LichessTactic(
        training_item_id=item.id,
        puzzle_id=puzzle_id,
        fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        moves="e2e4 e7e5",
        rating=rating,
        rating_deviation=100,
        popularity=80,
        nb_plays=50,
        game_url=f"https://lichess.org/{puzzle_id}",
    )
    session.add(tactic)
    session.flush()
    return item


def _make_positional(  # type: ignore[misc]
    session,
    internal_id: int,
    difficulty_value: int = 1,
    theme_names: list[str] | None = None,
    opening_name: str | None = None,
):
    from app.models.training_item import TrainingItem, TrainingItemSource
    from app.models.scraped_positional_puzzle import ScrapedPositionalPuzzle, scraped_positional_theme_links
    from app.models.opening import Opening

    difficulty = _get_or_create_difficulty(session, difficulty_value)

    opening_id = None
    if opening_name:
        opening = session.execute(
            sa.select(Opening).where(Opening.name == opening_name)
        ).scalar_one_or_none()
        if opening is None:
            opening = Opening(name=opening_name, display_name=opening_name)
            session.add(opening)
            session.flush()
        opening_id = opening.id

    item = TrainingItem(source_type=TrainingItemSource.SCRAPED_POSITIONAL)
    session.add(item)
    session.flush()

    puzzle = ScrapedPositionalPuzzle(
        training_item_id=item.id,
        internal_id=internal_id,
        fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        moves="e2e4",
        lichess_url=f"https://lichess.org/analysis/{internal_id}",
        difficulty_id=difficulty.id,
        opening_id=opening_id,
    )
    session.add(puzzle)
    session.flush()

    for name in (theme_names or []):
        theme = _get_or_create_theme(session, name)
        session.execute(
            scraped_positional_theme_links.insert().values(
                positional_puzzle_id=puzzle.id,
                positional_theme_id=theme.id,
            )
        )
    session.flush()
    return item


def _make_subset(session, user, config: dict | None = None, puzzle_count: int = 10):  # type: ignore[misc]
    from app.models.subset import Subset
    subset = Subset(user_id=user.id, name="Test subset", puzzle_count=puzzle_count, config=config)
    session.add(subset)
    session.flush()
    return subset


def _add_item_to_subset(session, subset, training_item, position: int = 0):  # type: ignore[misc]
    from app.models.subset import SubsetTrainingItem
    row = SubsetTrainingItem(
        subset_id=subset.id,
        training_item_id=training_item.id,
        position=position,
    )
    session.add(row)
    session.flush()


def _make_decoy(session, accepted_moves: list | None = None):  # type: ignore[misc]
    from app.models.training_item import TrainingItem, TrainingItemSource
    from app.models.decoy_puzzle import DecoyPuzzle
    item = TrainingItem(source_type=TrainingItemSource.DECOY)
    session.add(item)
    session.flush()
    moves = accepted_moves if accepted_moves is not None else [
        {"uci": "e2e4", "cp": 30, "drop_cp": 20},
        {"uci": "d2d4", "cp": 25, "drop_cp": 15},
        {"uci": "c2c4", "cp": 20, "drop_cp": 10},
    ]
    puzzle = DecoyPuzzle(
        training_item_id=item.id,
        fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        opponent_move="e7e5",
        accepted_moves=moves,
        best_cp=50,
        depth=20,
        move_number=22,
    )
    session.add(puzzle)
    session.flush()
    return item


def _lock_subset(session, subset):  # type: ignore[misc]
    subset.locked_at = datetime.now(timezone.utc)
    subset.locked_puzzle_count = 0
    session.flush()


_LICHESS_CONFIG = {"sources": [{"source": "LICHESS_TACTIC", "percentage": 100, "config": {}}]}


# ── Pure unit: _distribute_counts ────────────────────────────────────────────────

class TestDistributeCounts:
    def test_exact_split(self) -> None:
        from app.services.subset import _distribute_counts
        sources = [{"percentage": 60}, {"percentage": 40}]
        assert _distribute_counts(sources, 10) == [6, 4]

    def test_remainder_goes_to_highest_fractional_part(self) -> None:
        from app.services.subset import _distribute_counts
        # 7 * 40% = 2.8 → 3; 7 * 60% = 4.2 → 4
        sources = [{"percentage": 60}, {"percentage": 40}]
        counts = _distribute_counts(sources, 7)
        assert sum(counts) == 7
        assert counts[1] == 3  # 40% has higher fractional part (0.8 > 0.2)

    def test_single_source_gets_all(self) -> None:
        from app.services.subset import _distribute_counts
        assert _distribute_counts([{"percentage": 100}], 13) == [13]

    def test_counts_always_sum_to_total(self) -> None:
        from app.services.subset import _distribute_counts
        sources = [{"percentage": 33}, {"percentage": 33}, {"percentage": 34}]
        for total in range(1, 20):
            assert sum(_distribute_counts(sources, total)) == total


# ── Service: _sample_scraped_positionals ─────────────────────────────────────────

@pytest.mark.integration
class TestSampleScrapedPositionals:
    def test_returns_all_when_no_filters(self, db_session) -> None:
        from app.services.subset import _sample_scraped_positionals
        user = _make_user(db_session, "sp_nofilter")
        subset = _make_subset(db_session, user)
        _make_positional(db_session, 1001, difficulty_value=1)
        _make_positional(db_session, 1002, difficulty_value=2)

        ids = _sample_scraped_positionals({}, subset.id, 10)

        assert len(ids) == 2

    def test_filters_by_difficulty(self, db_session) -> None:
        from app.services.subset import _sample_scraped_positionals
        user = _make_user(db_session, "sp_difficulty")
        subset = _make_subset(db_session, user)
        easy = _make_positional(db_session, 2001, difficulty_value=1)
        _make_positional(db_session, 2002, difficulty_value=3)

        ids = _sample_scraped_positionals({"difficulty": [1]}, subset.id, 10)

        assert ids == [easy.id]

    def test_empty_difficulty_list_returns_all(self, db_session) -> None:
        from app.services.subset import _sample_scraped_positionals
        user = _make_user(db_session, "sp_emptydiff")
        subset = _make_subset(db_session, user)
        _make_positional(db_session, 3001, difficulty_value=1)
        _make_positional(db_session, 3002, difficulty_value=2)

        ids = _sample_scraped_positionals({"difficulty": []}, subset.id, 10)

        assert len(ids) == 2

    def test_filters_by_theme(self, db_session) -> None:
        from app.services.subset import _sample_scraped_positionals
        user = _make_user(db_session, "sp_theme")
        subset = _make_subset(db_session, user)
        space_item = _make_positional(db_session, 4001, theme_names=["space"])
        _make_positional(db_session, 4002, theme_names=["kingsafety"])

        ids = _sample_scraped_positionals({"themes": ["space"]}, subset.id, 10)

        assert ids == [space_item.id]

    def test_empty_theme_list_returns_all(self, db_session) -> None:
        from app.services.subset import _sample_scraped_positionals
        user = _make_user(db_session, "sp_emptytheme")
        subset = _make_subset(db_session, user)
        _make_positional(db_session, 5001, theme_names=["space"])
        _make_positional(db_session, 5002, theme_names=["kingsafety"])

        ids = _sample_scraped_positionals({"themes": []}, subset.id, 10)

        assert len(ids) == 2

    def test_excludes_items_already_in_subset(self, db_session) -> None:
        from app.services.subset import _sample_scraped_positionals
        user = _make_user(db_session, "sp_exclude")
        subset = _make_subset(db_session, user)
        already_in = _make_positional(db_session, 6001)
        eligible = _make_positional(db_session, 6002)
        _add_item_to_subset(db_session, subset, already_in, position=0)

        ids = _sample_scraped_positionals({}, subset.id, 10)

        assert eligible.id in ids
        assert already_in.id not in ids

    def test_short_pool_returns_what_is_available(self, db_session) -> None:
        from app.services.subset import _sample_scraped_positionals
        user = _make_user(db_session, "sp_short")
        subset = _make_subset(db_session, user)
        _make_positional(db_session, 7001)

        ids = _sample_scraped_positionals({}, subset.id, 100)

        assert len(ids) == 1


# ── Service: _sample_all_sources ─────────────────────────────────────────────────

@pytest.mark.integration
class TestSampleAllSources:
    def test_distributes_count_by_percentage(self, db_session) -> None:
        from app.services.subset import _sample_all_sources
        user = _make_user(db_session, "sa_distribute")
        subset = _make_subset(db_session, user)
        for i in range(6):
            _make_tactic(db_session, f"sa_tac_{i}", rating=1500)
        for i in range(4):
            _make_positional(db_session, 8000 + i)

        sources = [
            {"source": "LICHESS_TACTIC", "percentage": 60, "config": {}},
            {"source": "SCRAPED_POSITIONAL", "percentage": 40, "config": {}},
        ]
        ids = _sample_all_sources(sources, subset.id, 10)

        assert len(ids) == 10

    def test_short_pool_does_not_raise(self, db_session) -> None:
        from app.services.subset import _sample_all_sources
        user = _make_user(db_session, "sa_short")
        subset = _make_subset(db_session, user)
        _make_tactic(db_session, "sa_short_tac", rating=1500)
        # positional pool is empty

        sources = [
            {"source": "LICHESS_TACTIC", "percentage": 50, "config": {}},
            {"source": "SCRAPED_POSITIONAL", "percentage": 50, "config": {}},
        ]
        ids = _sample_all_sources(sources, subset.id, 10)

        assert len(ids) == 1  # only the one tactic, positional pool was empty

    def test_mixed_sources_returns_ids_from_both(self, db_session) -> None:
        from app.services.subset import _sample_all_sources
        user = _make_user(db_session, "sa_mixed")
        subset = _make_subset(db_session, user)
        tactic_item = _make_tactic(db_session, "sa_mixed_tac", rating=1500)
        positional_item = _make_positional(db_session, 9001)

        sources = [
            {"source": "LICHESS_TACTIC", "percentage": 50, "config": {}},
            {"source": "SCRAPED_POSITIONAL", "percentage": 50, "config": {}},
        ]
        ids = _sample_all_sources(sources, subset.id, 2)

        assert tactic_item.id in ids
        assert positional_item.id in ids

    def test_dispatches_subset_ref_entries(self, db_session) -> None:
        from app.services.subset import _sample_all_sources
        user = _make_user(db_session, "sa_refs")
        source_subset = _make_subset(db_session, user)
        target_subset = _make_subset(db_session, user)
        tactic = _make_tactic(db_session, "sa_refs_tac", rating=1500)
        ref_item = _make_positional(db_session, 9100)
        _add_item_to_subset(db_session, source_subset, ref_item)
        _lock_subset(db_session, source_subset)

        sources = [{"source": "LICHESS_TACTIC", "percentage": 50, "config": {}}]
        subset_refs = [{"subsetId": source_subset.id, "percentage": 50}]
        ids = _sample_all_sources(sources, target_subset.id, 2, subset_refs=subset_refs)

        assert tactic.id in ids
        assert ref_item.id in ids

    def test_exclude_subsets_removes_items_across_all_samplers(self, db_session) -> None:
        from app.services.subset import _sample_all_sources
        user = _make_user(db_session, "sa_excl")
        target_subset = _make_subset(db_session, user)
        excl_subset = _make_subset(db_session, user)
        excluded_tactic = _make_tactic(db_session, "sa_excl_tac1", rating=1500)
        kept_tactic = _make_tactic(db_session, "sa_excl_tac2", rating=1500)
        _add_item_to_subset(db_session, excl_subset, excluded_tactic)
        _lock_subset(db_session, excl_subset)

        sources = [{"source": "LICHESS_TACTIC", "percentage": 100, "config": {}}]
        ids = _sample_all_sources(
            sources, target_subset.id, 10,
            exclude_subset_ids=[excl_subset.id],
        )

        assert excluded_tactic.id not in ids
        assert kept_tactic.id in ids

    def test_decoy_source_dispatches_correctly(self, db_session) -> None:
        from app.services.subset import _sample_all_sources
        user = _make_user(db_session, "sa_decoy")
        subset = _make_subset(db_session, user)
        decoy_item = _make_decoy(db_session)

        sources = [{"source": "DECOY", "percentage": 100, "config": {}}]
        ids = _sample_all_sources(sources, subset.id, 10)

        assert decoy_item.id in ids


# ── Migration SQL ────────────────────────────────────────────────────────────────

_MIGRATION_SQL = """
    UPDATE subsets
    SET config = jsonb_build_object(
        'sources', jsonb_build_array(
            jsonb_build_object(
                'source', 'LICHESS_TACTIC',
                'percentage', 100,
                'config', config
            )
        )
    )
    WHERE config @> '{}'::jsonb
      AND NOT (config ? 'sources')
"""


@pytest.mark.integration
class TestSubsetConfigMigration:
    def test_flat_config_wrapped_to_sources_array(self, db_session) -> None:
        user = _make_user(db_session, "mig_flat")
        flat_config = {"rating": {"min": 1000, "max": 2000}, "themes": {"fork": 2}}
        subset = _make_subset(db_session, user, config=flat_config)

        db_session.execute(sa.text(_MIGRATION_SQL))

        db_session.refresh(subset)
        sources = subset.config["sources"]  # type: ignore[index]
        assert len(sources) == 1
        assert sources[0]["source"] == "LICHESS_TACTIC"
        assert sources[0]["percentage"] == 100
        assert sources[0]["config"] == flat_config

    def test_already_wrapped_config_is_unchanged(self, db_session) -> None:
        user = _make_user(db_session, "mig_wrapped")
        wrapped = {"sources": [{"source": "LICHESS_TACTIC", "percentage": 100, "config": {}}]}
        subset = _make_subset(db_session, user, config=wrapped)

        db_session.execute(sa.text(_MIGRATION_SQL))

        db_session.refresh(subset)
        assert subset.config == wrapped

    def test_null_config_is_unchanged(self, db_session) -> None:
        user = _make_user(db_session, "mig_null")
        subset = _make_subset(db_session, user, config=None)

        db_session.execute(sa.text(_MIGRATION_SQL))

        db_session.refresh(subset)
        assert subset.config is None


# ── Route: PATCH /subsets/{id}/config ────────────────────────────────────────────

@pytest.mark.integration
class TestPatchConfig:
    def test_requires_login(self, client: FlaskClient) -> None:
        assert client.patch("/subsets/1/config", json={}).status_code == 401

    def test_accepts_valid_multi_source_config(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "pc_valid")
        _login(client, user.id)
        subset = _make_subset(db_session, user, puzzle_count=10)
        config = {"sources": [{"source": "LICHESS_TACTIC", "percentage": 100, "config": {}}]}

        resp = client.patch(
            f"/subsets/{subset.id}/config",
            json={"puzzleCount": 10, "config": config},
        )

        assert resp.status_code == 200
        assert resp.get_json()["config"] == config

    def test_rejects_percentages_not_summing_to_100(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "pc_badpct")
        _login(client, user.id)
        subset = _make_subset(db_session, user)
        config = {
            "sources": [
                {"source": "LICHESS_TACTIC", "percentage": 60, "config": {}},
                {"source": "SCRAPED_POSITIONAL", "percentage": 30, "config": {}},
            ]
        }

        resp = client.patch(
            f"/subsets/{subset.id}/config",
            json={"puzzleCount": 10, "config": config},
        )

        assert resp.status_code == 422
        assert "100" in resp.get_json()["detail"]

    def test_rejects_missing_sources_key(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "pc_nosrc")
        _login(client, user.id)
        subset = _make_subset(db_session, user)

        resp = client.patch(
            f"/subsets/{subset.id}/config",
            json={"puzzleCount": 10, "config": {"rating": {"min": 0, "max": 9999}}},
        )

        assert resp.status_code == 422

    def test_rejects_unknown_source_name(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "pc_unknownsrc")
        _login(client, user.id)
        subset = _make_subset(db_session, user)
        config = {"sources": [{"source": "MADE_UP_SOURCE", "percentage": 100, "config": {}}]}

        resp = client.patch(
            f"/subsets/{subset.id}/config",
            json={"puzzleCount": 10, "config": config},
        )

        assert resp.status_code == 422

    def test_rejects_zero_percentage(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "pc_zeropct")
        _login(client, user.id)
        subset = _make_subset(db_session, user)
        config = {
            "sources": [
                {"source": "LICHESS_TACTIC", "percentage": 100, "config": {}},
                {"source": "SCRAPED_POSITIONAL", "percentage": 0, "config": {}},
            ]
        }

        resp = client.patch(
            f"/subsets/{subset.id}/config",
            json={"puzzleCount": 10, "config": config},
        )

        assert resp.status_code == 422

    def test_clears_existing_training_items_on_save(self, client: FlaskClient, db_session) -> None:
        from app.models.subset import SubsetTrainingItem
        user = _make_user(db_session, "pc_clear")
        _login(client, user.id)
        subset = _make_subset(db_session, user, config=_LICHESS_CONFIG)
        tactic = _make_tactic(db_session, "pc_clear_tac")
        _add_item_to_subset(db_session, subset, tactic)

        client.patch(
            f"/subsets/{subset.id}/config",
            json={"puzzleCount": 10, "config": _LICHESS_CONFIG},
        )

        count = db_session.execute(
            sa.select(sa.func.count()).where(SubsetTrainingItem.subset_id == subset.id)
        ).scalar_one()
        assert count == 0


# ── Route: DELETE /subsets/{id}/puzzles/{training_item_id} ───────────────────────
# Target behavior — will be red until the route is updated to use training_item_id.

@pytest.mark.integration
class TestDiscardByTrainingItemId:
    def test_discards_scraped_positional_item(self, client: FlaskClient, db_session) -> None:
        from app.models.subset import SubsetTrainingItem
        user = _make_user(db_session, "dis_pos")
        _login(client, user.id)
        subset = _make_subset(db_session, user, config=_LICHESS_CONFIG)
        item = _make_positional(db_session, 10001)
        _add_item_to_subset(db_session, subset, item)

        resp = client.delete(f"/subsets/{subset.id}/puzzles/{item.id}")

        assert resp.status_code == 204
        remaining = db_session.execute(
            sa.select(sa.func.count()).where(SubsetTrainingItem.subset_id == subset.id)
        ).scalar_one()
        assert remaining == 0

    def test_discards_lichess_tactic_by_training_item_id(self, client: FlaskClient, db_session) -> None:
        from app.models.subset import SubsetTrainingItem
        user = _make_user(db_session, "dis_tac")
        _login(client, user.id)
        subset = _make_subset(db_session, user, config=_LICHESS_CONFIG)
        item = _make_tactic(db_session, "dis_tac_puzzle")
        _add_item_to_subset(db_session, subset, item)

        resp = client.delete(f"/subsets/{subset.id}/puzzles/{item.id}")

        assert resp.status_code == 204
        remaining = db_session.execute(
            sa.select(sa.func.count()).where(SubsetTrainingItem.subset_id == subset.id)
        ).scalar_one()
        assert remaining == 0

    def test_404_for_nonexistent_training_item_id(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "dis_404")
        _login(client, user.id)
        subset = _make_subset(db_session, user, config=_LICHESS_CONFIG)

        resp = client.delete(f"/subsets/{subset.id}/puzzles/99999")

        assert resp.status_code == 404

    def test_requires_login(self, client: FlaskClient) -> None:
        assert client.delete("/subsets/1/puzzles/1").status_code == 401


# ── Route: GET /subsets/{id}/stats ───────────────────────────────────────────────
# Target per-source shape — will be red until stats are refactored.

@pytest.mark.integration
class TestGetStatsPerSource:
    def test_response_has_sources_key(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "stats_shape")
        _login(client, user.id)
        subset = _make_subset(db_session, user, config=_LICHESS_CONFIG)

        body = client.get(f"/subsets/{subset.id}/stats").get_json()

        assert "sources" in body

    def test_lichess_source_count_matches_items(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "stats_lt_count")
        _login(client, user.id)
        subset = _make_subset(db_session, user, config=_LICHESS_CONFIG)
        for i in range(3):
            item = _make_tactic(db_session, f"stats_lt_{i}")
            _add_item_to_subset(db_session, subset, item, position=i)

        body = client.get(f"/subsets/{subset.id}/stats").get_json()

        assert body["sources"]["LICHESS_TACTIC"]["count"] == 3

    def test_positional_source_count_matches_items(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "stats_pos_count")
        config = {
            "sources": [
                {"source": "SCRAPED_POSITIONAL", "percentage": 100, "config": {}},
            ]
        }
        _login(client, user.id)
        subset = _make_subset(db_session, user, config=config)
        for i in range(2):
            item = _make_positional(db_session, 11000 + i)
            _add_item_to_subset(db_session, subset, item, position=i)

        body = client.get(f"/subsets/{subset.id}/stats").get_json()

        assert body["sources"]["SCRAPED_POSITIONAL"]["count"] == 2


# ── Service: _sample_decoys ───────────────────────────────────────────────────────

@pytest.mark.integration
class TestSampleDecoys:
    def test_default_min_includes_all_decoys(self, db_session) -> None:
        from app.services.subset import _sample_decoys
        user = _make_user(db_session, "sd_default")
        subset = _make_subset(db_session, user)
        d3 = _make_decoy(db_session, accepted_moves=[
            {"uci": "e2e4", "cp": 30, "drop_cp": 20},
            {"uci": "d2d4", "cp": 25, "drop_cp": 15},
            {"uci": "c2c4", "cp": 20, "drop_cp": 10},
        ])
        d5 = _make_decoy(db_session, accepted_moves=[
            {"uci": "e2e4", "cp": 30, "drop_cp": 20},
            {"uci": "d2d4", "cp": 28, "drop_cp": 18},
            {"uci": "c2c4", "cp": 25, "drop_cp": 15},
            {"uci": "g1f3", "cp": 22, "drop_cp": 12},
            {"uci": "b1c3", "cp": 20, "drop_cp": 10},
        ])

        ids = _sample_decoys({}, subset.id, 10)

        assert d3.id in ids
        assert d5.id in ids

    def test_single_count_4_includes_only_decoys_with_4_moves(self, db_session) -> None:
        from app.services.subset import _sample_decoys
        user = _make_user(db_session, "sd_cnt4")
        subset = _make_subset(db_session, user)
        d3 = _make_decoy(db_session, accepted_moves=[
            {"uci": "e2e4", "cp": 30, "drop_cp": 20},
            {"uci": "d2d4", "cp": 25, "drop_cp": 15},
            {"uci": "c2c4", "cp": 20, "drop_cp": 10},
        ])
        d4 = _make_decoy(db_session, accepted_moves=[
            {"uci": "e2e4", "cp": 30, "drop_cp": 20},
            {"uci": "d2d4", "cp": 28, "drop_cp": 18},
            {"uci": "c2c4", "cp": 25, "drop_cp": 15},
            {"uci": "g1f3", "cp": 22, "drop_cp": 12},
        ])
        d5 = _make_decoy(db_session, accepted_moves=[
            {"uci": "e2e4", "cp": 30, "drop_cp": 20},
            {"uci": "d2d4", "cp": 28, "drop_cp": 18},
            {"uci": "c2c4", "cp": 25, "drop_cp": 15},
            {"uci": "g1f3", "cp": 22, "drop_cp": 12},
            {"uci": "b1c3", "cp": 20, "drop_cp": 10},
        ])

        ids = _sample_decoys({"acceptedMovesCounts": [4]}, subset.id, 10)

        assert d3.id not in ids
        assert d4.id in ids
        assert d5.id not in ids

    def test_multi_count_3_and_5_includes_exact_matches_only(self, db_session) -> None:
        from app.services.subset import _sample_decoys
        user = _make_user(db_session, "sd_cnt35")
        subset = _make_subset(db_session, user)
        d3 = _make_decoy(db_session, accepted_moves=[
            {"uci": "e2e4", "cp": 30, "drop_cp": 20},
            {"uci": "d2d4", "cp": 25, "drop_cp": 15},
            {"uci": "c2c4", "cp": 20, "drop_cp": 10},
        ])
        d4 = _make_decoy(db_session, accepted_moves=[
            {"uci": "e2e4", "cp": 30, "drop_cp": 20},
            {"uci": "d2d4", "cp": 28, "drop_cp": 18},
            {"uci": "c2c4", "cp": 25, "drop_cp": 15},
            {"uci": "g1f3", "cp": 22, "drop_cp": 12},
        ])
        d5 = _make_decoy(db_session, accepted_moves=[
            {"uci": "e2e4", "cp": 30, "drop_cp": 20},
            {"uci": "d2d4", "cp": 28, "drop_cp": 18},
            {"uci": "c2c4", "cp": 25, "drop_cp": 15},
            {"uci": "g1f3", "cp": 22, "drop_cp": 12},
            {"uci": "b1c3", "cp": 20, "drop_cp": 10},
        ])

        ids = _sample_decoys({"acceptedMovesCounts": [3, 5]}, subset.id, 10)

        assert d3.id in ids
        assert d4.id not in ids
        assert d5.id in ids

    def test_single_count_6_excludes_decoys_with_fewer_moves(self, db_session) -> None:
        from app.services.subset import _sample_decoys
        user = _make_user(db_session, "sd_cnt6")
        subset = _make_subset(db_session, user)
        d5 = _make_decoy(db_session, accepted_moves=[
            {"uci": f"e{i}e{i+1}", "cp": 30 - i, "drop_cp": 10}
            for i in range(5)
        ])
        d6 = _make_decoy(db_session, accepted_moves=[
            {"uci": f"e{i}e{i+1}", "cp": 30 - i, "drop_cp": 10}
            for i in range(6)
        ])

        ids = _sample_decoys({"acceptedMovesCounts": [6]}, subset.id, 10)

        assert d5.id not in ids
        assert d6.id in ids

    def test_excluded_ti_ids_are_skipped(self, db_session) -> None:
        from app.services.subset import _sample_decoys
        user = _make_user(db_session, "sd_excl")
        subset = _make_subset(db_session, user)
        excl = _make_decoy(db_session)
        eligible = _make_decoy(db_session)

        ids = _sample_decoys({}, subset.id, 10, exclude_ti_ids=[excl.id])

        assert excl.id not in ids
        assert eligible.id in ids

    def test_excludes_items_already_in_target_subset(self, db_session) -> None:
        from app.services.subset import _sample_decoys
        user = _make_user(db_session, "sd_in_target")
        subset = _make_subset(db_session, user)
        already_in = _make_decoy(db_session)
        not_in = _make_decoy(db_session)
        _add_item_to_subset(db_session, subset, already_in)

        ids = _sample_decoys({}, subset.id, 10)

        assert already_in.id not in ids
        assert not_in.id in ids


# ── Service: _sample_subset_ref ───────────────────────────────────────────────────

@pytest.mark.integration
class TestSampleSubsetRef:
    def test_draws_items_from_referenced_subset(self, db_session) -> None:
        from app.services.subset import _sample_subset_ref
        user = _make_user(db_session, "ssr_basic")
        source_subset = _make_subset(db_session, user)
        target_subset = _make_subset(db_session, user)
        item = _make_tactic(db_session, "ssr_basic_tac")
        _add_item_to_subset(db_session, source_subset, item)
        _lock_subset(db_session, source_subset)

        ids = _sample_subset_ref(
            {"subsetId": source_subset.id, "percentage": 100},
            target_subset.id,
            count=10,
        )

        assert item.id in ids

    def test_excludes_items_already_in_target_subset(self, db_session) -> None:
        from app.services.subset import _sample_subset_ref
        user = _make_user(db_session, "ssr_excl_target")
        source_subset = _make_subset(db_session, user)
        target_subset = _make_subset(db_session, user)
        already_there = _make_tactic(db_session, "ssr_already")
        not_there = _make_tactic(db_session, "ssr_notthere")
        _add_item_to_subset(db_session, source_subset, already_there)
        _add_item_to_subset(db_session, source_subset, not_there)
        _add_item_to_subset(db_session, target_subset, already_there)
        _lock_subset(db_session, source_subset)

        ids = _sample_subset_ref(
            {"subsetId": source_subset.id, "percentage": 100},
            target_subset.id,
            count=10,
        )

        assert already_there.id not in ids
        assert not_there.id in ids

    def test_exclude_sources_filters_by_source_type(self, db_session) -> None:
        from app.services.subset import _sample_subset_ref
        user = _make_user(db_session, "ssr_exclsrc")
        source_subset = _make_subset(db_session, user)
        target_subset = _make_subset(db_session, user)
        tactic = _make_tactic(db_session, "ssr_exclsrc_tac")
        positional = _make_positional(db_session, 20001)
        _add_item_to_subset(db_session, source_subset, tactic)
        _add_item_to_subset(db_session, source_subset, positional)
        _lock_subset(db_session, source_subset)

        ids = _sample_subset_ref(
            {"subsetId": source_subset.id, "percentage": 100, "excludeSources": ["LICHESS_TACTIC"]},
            target_subset.id,
            count=10,
        )

        assert tactic.id not in ids
        assert positional.id in ids

    def test_exclude_ti_ids_are_skipped(self, db_session) -> None:
        from app.services.subset import _sample_subset_ref
        user = _make_user(db_session, "ssr_excl_ids")
        source_subset = _make_subset(db_session, user)
        target_subset = _make_subset(db_session, user)
        excl_item = _make_tactic(db_session, "ssr_excl_ids_excl")
        keep_item = _make_tactic(db_session, "ssr_excl_ids_keep")
        _add_item_to_subset(db_session, source_subset, excl_item)
        _add_item_to_subset(db_session, source_subset, keep_item)
        _lock_subset(db_session, source_subset)

        ids = _sample_subset_ref(
            {"subsetId": source_subset.id, "percentage": 100},
            target_subset.id,
            count=10,
            exclude_ti_ids=[excl_item.id],
        )

        assert excl_item.id not in ids
        assert keep_item.id in ids

    def test_short_pool_returns_what_is_available(self, db_session) -> None:
        from app.services.subset import _sample_subset_ref
        user = _make_user(db_session, "ssr_short")
        source_subset = _make_subset(db_session, user)
        target_subset = _make_subset(db_session, user)
        item = _make_tactic(db_session, "ssr_short_tac")
        _add_item_to_subset(db_session, source_subset, item)
        _lock_subset(db_session, source_subset)

        ids = _sample_subset_ref(
            {"subsetId": source_subset.id, "percentage": 100},
            target_subset.id,
            count=100,
        )

        assert len(ids) == 1


# ── Route: PATCH /subsets/{id}/config — SubsetRef and ExcludedSubsets ────────────

@pytest.mark.integration
class TestPatchConfigSubsetRefs:
    def test_accepts_valid_config_with_subset_ref(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "pcsr_valid")
        _login(client, user.id)
        target = _make_subset(db_session, user, puzzle_count=10)
        source = _make_subset(db_session, user)
        _lock_subset(db_session, source)
        config = {
            "sources": [{"source": "LICHESS_TACTIC", "percentage": 60, "config": {}}],
            "subsetRefs": [{"subsetId": source.id, "percentage": 40}],
        }

        resp = client.patch(
            f"/subsets/{target.id}/config",
            json={"puzzleCount": 10, "config": config},
        )

        assert resp.status_code == 200

    def test_accepts_config_with_only_subset_refs(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "pcsr_onlyrefs")
        _login(client, user.id)
        target = _make_subset(db_session, user, puzzle_count=10)
        source = _make_subset(db_session, user)
        _lock_subset(db_session, source)
        config = {"subsetRefs": [{"subsetId": source.id, "percentage": 100}]}

        resp = client.patch(
            f"/subsets/{target.id}/config",
            json={"puzzleCount": 10, "config": config},
        )

        assert resp.status_code == 200

    def test_accepts_config_with_exclude_subsets(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "pcsr_excl")
        _login(client, user.id)
        target = _make_subset(db_session, user, puzzle_count=10)
        excl = _make_subset(db_session, user)
        _lock_subset(db_session, excl)
        config = {
            "sources": [{"source": "LICHESS_TACTIC", "percentage": 100, "config": {}}],
            "excludeSubsets": [excl.id],
        }

        resp = client.patch(
            f"/subsets/{target.id}/config",
            json={"puzzleCount": 10, "config": config},
        )

        assert resp.status_code == 200

    def test_rejects_combined_percentages_not_100(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "pcsr_badpct")
        _login(client, user.id)
        target = _make_subset(db_session, user, puzzle_count=10)
        source = _make_subset(db_session, user)
        _lock_subset(db_session, source)
        config = {
            "sources": [{"source": "LICHESS_TACTIC", "percentage": 50, "config": {}}],
            "subsetRefs": [{"subsetId": source.id, "percentage": 40}],
        }

        resp = client.patch(
            f"/subsets/{target.id}/config",
            json={"puzzleCount": 10, "config": config},
        )

        assert resp.status_code == 422
        assert "100" in resp.get_json()["detail"]

    def test_rejects_subset_ref_to_unlocked_subset(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "pcsr_unlocked")
        _login(client, user.id)
        target = _make_subset(db_session, user, puzzle_count=10)
        unlocked = _make_subset(db_session, user)
        config = {"subsetRefs": [{"subsetId": unlocked.id, "percentage": 100}]}

        resp = client.patch(
            f"/subsets/{target.id}/config",
            json={"puzzleCount": 10, "config": config},
        )

        assert resp.status_code == 422

    def test_rejects_subset_ref_id_also_in_exclude_subsets(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "pcsr_overlap")
        _login(client, user.id)
        target = _make_subset(db_session, user, puzzle_count=10)
        locked = _make_subset(db_session, user)
        _lock_subset(db_session, locked)
        config = {
            "subsetRefs": [{"subsetId": locked.id, "percentage": 100}],
            "excludeSubsets": [locked.id],
        }

        resp = client.patch(
            f"/subsets/{target.id}/config",
            json={"puzzleCount": 10, "config": config},
        )

        assert resp.status_code == 422

    def test_rejects_subset_ref_with_percentage_zero(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "pcsr_zeropct")
        _login(client, user.id)
        target = _make_subset(db_session, user, puzzle_count=10)
        source = _make_subset(db_session, user)
        _lock_subset(db_session, source)
        config = {
            "sources": [{"source": "LICHESS_TACTIC", "percentage": 100, "config": {}}],
            "subsetRefs": [{"subsetId": source.id, "percentage": 0}],
        }

        resp = client.patch(
            f"/subsets/{target.id}/config",
            json={"puzzleCount": 10, "config": config},
        )

        assert resp.status_code == 422

    def test_rejects_exclude_subsets_with_unlocked_id(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "pcsr_excl_unlocked")
        _login(client, user.id)
        target = _make_subset(db_session, user, puzzle_count=10)
        unlocked = _make_subset(db_session, user)
        config = {
            "sources": [{"source": "LICHESS_TACTIC", "percentage": 100, "config": {}}],
            "excludeSubsets": [unlocked.id],
        }

        resp = client.patch(
            f"/subsets/{target.id}/config",
            json={"puzzleCount": 10, "config": config},
        )

        assert resp.status_code == 422


# ── Route: POST /subsets/<id>/fill ───────────────────────────────────────────────

@pytest.mark.integration
class TestFillRoute:
    def test_requires_login(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "fr_unauth")
        subset = _make_subset(db_session, user, puzzle_count=5)
        assert client.post(f"/subsets/{subset.id}/fill").status_code == 401

    def test_fills_subset_with_tactic_source(self, client: FlaskClient, db_session) -> None:
        from app.models.subset import SubsetTrainingItem
        user = _make_user(db_session, "fr_tactic")
        _login(client, user.id)
        _make_tactic(db_session, "fr_tactic_item", rating=1500)
        subset = _make_subset(db_session, user, puzzle_count=5)
        client.patch(
            f"/subsets/{subset.id}/config",
            json={"puzzleCount": 5, "config": _LICHESS_CONFIG},
        )

        resp = client.post(f"/subsets/{subset.id}/fill")

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["filled"] == 1
        assert body["requested"] == 5
        assert db_session.query(SubsetTrainingItem).filter_by(subset_id=subset.id).count() == 1

    def test_fills_subset_from_subset_ref(self, client: FlaskClient, db_session) -> None:
        from app.models.subset import SubsetTrainingItem
        user = _make_user(db_session, "fr_ref")
        _login(client, user.id)
        source_subset = _make_subset(db_session, user)
        target_subset = _make_subset(db_session, user, puzzle_count=5)
        item = _make_positional(db_session, 30001)
        _add_item_to_subset(db_session, source_subset, item)
        _lock_subset(db_session, source_subset)

        config = {"subsetRefs": [{"subsetId": source_subset.id, "percentage": 100}]}
        client.patch(
            f"/subsets/{target_subset.id}/config",
            json={"puzzleCount": 5, "config": config},
        )

        resp = client.post(f"/subsets/{target_subset.id}/fill")

        assert resp.status_code == 200
        inserted_ids = [
            row.training_item_id
            for row in db_session.query(SubsetTrainingItem).filter_by(subset_id=target_subset.id).all()
        ]
        assert item.id in inserted_ids

    def test_exclude_subsets_honoured_during_fill(self, client: FlaskClient, db_session) -> None:
        from app.models.subset import SubsetTrainingItem
        user = _make_user(db_session, "fr_excl")
        _login(client, user.id)
        target = _make_subset(db_session, user, puzzle_count=10)
        excl_subset = _make_subset(db_session, user)
        excluded_tactic = _make_tactic(db_session, "fr_excl_tac1", rating=1500)
        kept_tactic = _make_tactic(db_session, "fr_excl_tac2", rating=1500)
        _add_item_to_subset(db_session, excl_subset, excluded_tactic)
        _lock_subset(db_session, excl_subset)

        config = {
            "sources": [{"source": "LICHESS_TACTIC", "percentage": 100, "config": {}}],
            "excludeSubsets": [excl_subset.id],
        }
        client.patch(
            f"/subsets/{target.id}/config",
            json={"puzzleCount": 10, "config": config},
        )

        resp = client.post(f"/subsets/{target.id}/fill")

        assert resp.status_code == 200
        inserted_ids = [
            row.training_item_id
            for row in db_session.query(SubsetTrainingItem).filter_by(subset_id=target.id).all()
        ]
        assert excluded_tactic.id not in inserted_ids
        assert kept_tactic.id in inserted_ids

    def test_rejects_fill_on_locked_subset(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "fr_locked")
        _login(client, user.id)
        subset = _make_subset(db_session, user, puzzle_count=5)
        client.patch(
            f"/subsets/{subset.id}/config",
            json={"puzzleCount": 5, "config": _LICHESS_CONFIG},
        )
        _lock_subset(db_session, subset)

        resp = client.post(f"/subsets/{subset.id}/fill")

        assert resp.status_code == 409

    def test_rejects_fill_without_config(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "fr_noconfig")
        _login(client, user.id)
        subset = _make_subset(db_session, user, puzzle_count=5)

        resp = client.post(f"/subsets/{subset.id}/fill")

        assert resp.status_code == 422

    def test_second_fill_replaces_not_appends(self, client: FlaskClient, db_session) -> None:
        from app.models.subset import SubsetTrainingItem
        user = _make_user(db_session, "fr_replace")
        _login(client, user.id)
        _make_tactic(db_session, "fr_replace_tac", rating=1500)
        subset = _make_subset(db_session, user, puzzle_count=5)
        client.patch(
            f"/subsets/{subset.id}/config",
            json={"puzzleCount": 5, "config": _LICHESS_CONFIG},
        )
        client.post(f"/subsets/{subset.id}/fill")

        client.post(f"/subsets/{subset.id}/fill")

        count = db_session.query(SubsetTrainingItem).filter_by(subset_id=subset.id).count()
        assert count == 1  # same one item, not duplicated

    def test_fill_returns_zero_when_pool_empty(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "fr_empty")
        _login(client, user.id)
        subset = _make_subset(db_session, user, puzzle_count=5)
        client.patch(
            f"/subsets/{subset.id}/config",
            json={"puzzleCount": 5, "config": _LICHESS_CONFIG},
        )

        resp = client.post(f"/subsets/{subset.id}/fill")

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["filled"] == 0

    def test_exclude_subsets_blocks_items_arriving_via_subset_ref(
        self, client: FlaskClient, db_session
    ) -> None:
        from app.models.subset import SubsetTrainingItem
        user = _make_user(db_session, "fr_ref_excl")
        _login(client, user.id)
        ref_subset = _make_subset(db_session, user)
        excl_subset = _make_subset(db_session, user)
        target = _make_subset(db_session, user, puzzle_count=10)
        item_in_both = _make_tactic(db_session, "fr_ref_excl_both", rating=1500)
        item_ref_only = _make_tactic(db_session, "fr_ref_excl_refonly", rating=1500)
        _add_item_to_subset(db_session, ref_subset, item_in_both)
        _add_item_to_subset(db_session, ref_subset, item_ref_only)
        _add_item_to_subset(db_session, excl_subset, item_in_both)
        _lock_subset(db_session, ref_subset)
        _lock_subset(db_session, excl_subset)

        config = {
            "subsetRefs": [{"subsetId": ref_subset.id, "percentage": 100}],
            "excludeSubsets": [excl_subset.id],
        }
        client.patch(
            f"/subsets/{target.id}/config",
            json={"puzzleCount": 10, "config": config},
        )

        resp = client.post(f"/subsets/{target.id}/fill")

        assert resp.status_code == 200
        inserted_ids = [
            row.training_item_id
            for row in db_session.query(SubsetTrainingItem).filter_by(subset_id=target.id).all()
        ]
        assert item_in_both.id not in inserted_ids
        assert item_ref_only.id in inserted_ids


# ── Route: POST /subsets/<id>/refill ─────────────────────────────────────────────

@pytest.mark.integration
class TestRefillRoute:
    def test_requires_login(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "rfr_unauth")
        subset = _make_subset(db_session, user, puzzle_count=5)
        assert client.post(f"/subsets/{subset.id}/refill").status_code == 401

    def test_refills_only_the_gap(self, client: FlaskClient, db_session) -> None:
        from app.models.subset import SubsetTrainingItem
        user = _make_user(db_session, "rfr_gap")
        _login(client, user.id)
        t_existing = _make_tactic(db_session, "rfr_gap_existing", rating=1500)
        t_new = _make_tactic(db_session, "rfr_gap_new", rating=1500)
        subset = _make_subset(db_session, user, puzzle_count=5)
        client.patch(
            f"/subsets/{subset.id}/config",
            json={"puzzleCount": 5, "config": _LICHESS_CONFIG},
        )
        _add_item_to_subset(db_session, subset, t_existing, position=0)

        resp = client.post(f"/subsets/{subset.id}/refill")

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["needed"] == 4
        assert body["filled"] == 1
        assert db_session.query(SubsetTrainingItem).filter_by(subset_id=subset.id).count() == 2

    def test_returns_zero_when_already_full(self, client: FlaskClient, db_session) -> None:
        from app.models.subset import SubsetTrainingItem
        user = _make_user(db_session, "rfr_full")
        _login(client, user.id)
        tactics = [_make_tactic(db_session, f"rfr_full_t{i}", rating=1500) for i in range(5)]
        subset = _make_subset(db_session, user, puzzle_count=5)
        client.patch(
            f"/subsets/{subset.id}/config",
            json={"puzzleCount": 5, "config": _LICHESS_CONFIG},
        )
        for i, t in enumerate(tactics):
            _add_item_to_subset(db_session, subset, t, position=i)

        resp = client.post(f"/subsets/{subset.id}/refill")

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["filled"] == 0
        assert body["needed"] == 0
        assert db_session.query(SubsetTrainingItem).filter_by(subset_id=subset.id).count() == 5

    def test_refill_honours_exclude_subsets(self, client: FlaskClient, db_session) -> None:
        from app.models.subset import SubsetTrainingItem
        user = _make_user(db_session, "rfr_excl")
        _login(client, user.id)
        target = _make_subset(db_session, user, puzzle_count=5)
        excl_subset = _make_subset(db_session, user)
        kept = _make_tactic(db_session, "rfr_excl_kept", rating=1500)
        excluded = _make_tactic(db_session, "rfr_excl_excl", rating=1500)
        _add_item_to_subset(db_session, excl_subset, excluded)
        _lock_subset(db_session, excl_subset)
        config = {
            "sources": [{"source": "LICHESS_TACTIC", "percentage": 100, "config": {}}],
            "excludeSubsets": [excl_subset.id],
        }
        client.patch(
            f"/subsets/{target.id}/config",
            json={"puzzleCount": 5, "config": config},
        )

        resp = client.post(f"/subsets/{target.id}/refill")

        assert resp.status_code == 200
        inserted_ids = [
            row.training_item_id
            for row in db_session.query(SubsetTrainingItem).filter_by(subset_id=target.id).all()
        ]
        assert excluded.id not in inserted_ids
        assert kept.id in inserted_ids

    def test_rejects_refill_on_locked_subset(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "rfr_locked")
        _login(client, user.id)
        subset = _make_subset(db_session, user, puzzle_count=5)
        client.patch(
            f"/subsets/{subset.id}/config",
            json={"puzzleCount": 5, "config": _LICHESS_CONFIG},
        )
        _lock_subset(db_session, subset)

        resp = client.post(f"/subsets/{subset.id}/refill")

        assert resp.status_code == 409

    def test_rejects_refill_without_config(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "rfr_noconfig")
        _login(client, user.id)
        subset = _make_subset(db_session, user, puzzle_count=5)

        resp = client.post(f"/subsets/{subset.id}/refill")

        assert resp.status_code == 422


# ── Service: _resolve_excluded_ti_ids ────────────────────────────────────────────

@pytest.mark.integration
class TestResolveExcludedTiIds:
    def test_empty_list_returns_empty(self, db_session) -> None:
        from app.services.subset import _resolve_excluded_ti_ids
        assert _resolve_excluded_ti_ids([]) == []

    def test_returns_all_items_from_subset(self, db_session) -> None:
        from app.services.subset import _resolve_excluded_ti_ids
        user = _make_user(db_session, "reti_single")
        subset = _make_subset(db_session, user)
        t1 = _make_tactic(db_session, "reti_t1")
        t2 = _make_tactic(db_session, "reti_t2")
        _add_item_to_subset(db_session, subset, t1)
        _add_item_to_subset(db_session, subset, t2)

        ids = _resolve_excluded_ti_ids([subset.id])

        assert set(ids) == {t1.id, t2.id}

    def test_merges_items_from_multiple_subsets(self, db_session) -> None:
        from app.services.subset import _resolve_excluded_ti_ids
        user = _make_user(db_session, "reti_multi")
        s1 = _make_subset(db_session, user)
        s2 = _make_subset(db_session, user)
        t1 = _make_tactic(db_session, "reti_multi_t1")
        t2 = _make_tactic(db_session, "reti_multi_t2")
        _add_item_to_subset(db_session, s1, t1)
        _add_item_to_subset(db_session, s2, t2)

        ids = _resolve_excluded_ti_ids([s1.id, s2.id])

        assert set(ids) == {t1.id, t2.id}


# ── Route: GET /subsets?lockedOnly=true — hasTrained field ───────────────────────

@pytest.mark.integration
class TestListSubsetsLockedOnly:
    def test_locked_only_includes_has_trained_field(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "ls_hastrained")
        _login(client, user.id)
        subset = _make_subset(db_session, user)
        _lock_subset(db_session, subset)

        resp = client.get("/subsets?locked=true")

        assert resp.status_code == 200
        items = resp.get_json()["items"]
        assert len(items) == 1
        assert "hasTrained" in items[0]
        assert items[0]["hasTrained"] is False

    def test_locked_only_excludes_unlocked_subsets(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "ls_excl_unlocked")
        _login(client, user.id)
        _make_subset(db_session, user)

        resp = client.get("/subsets?locked=true")

        assert resp.status_code == 200
        assert resp.get_json()["items"] == []


# ── Route: GET /subsets/{id}/stats — DECOY source ────────────────────────────────

@pytest.mark.integration
class TestGetStatsDecoy:
    def test_decoy_source_appears_in_stats(self, client: FlaskClient, db_session) -> None:
        config = {"sources": [{"source": "DECOY", "percentage": 100, "config": {}}]}
        user = _make_user(db_session, "gsd_decoy")
        _login(client, user.id)
        subset = _make_subset(db_session, user, config=config)
        item = _make_decoy(db_session)
        _add_item_to_subset(db_session, subset, item)

        body = client.get(f"/subsets/{subset.id}/stats").get_json()

        assert "DECOY" in body["sources"]
        assert body["sources"]["DECOY"]["count"] == 1


# ── Route: PATCH /subsets/{id}/config — excludeSources validation ─────────────────

@pytest.mark.integration
class TestPatchConfigExcludeSources:
    def test_accepts_valid_exclude_sources_on_subset_ref(
        self, client: FlaskClient, db_session
    ) -> None:
        user = _make_user(db_session, "pces_valid")
        _login(client, user.id)
        target = _make_subset(db_session, user, puzzle_count=10)
        source = _make_subset(db_session, user)
        _lock_subset(db_session, source)
        config = {
            "subsetRefs": [{
                "subsetId": source.id,
                "percentage": 100,
                "excludeSources": ["LICHESS_TACTIC"],
            }]
        }

        resp = client.patch(
            f"/subsets/{target.id}/config",
            json={"puzzleCount": 10, "config": config},
        )

        assert resp.status_code == 200

    def test_rejects_unknown_source_in_exclude_sources(
        self, client: FlaskClient, db_session
    ) -> None:
        user = _make_user(db_session, "pces_bad")
        _login(client, user.id)
        target = _make_subset(db_session, user, puzzle_count=10)
        source = _make_subset(db_session, user)
        _lock_subset(db_session, source)
        config = {
            "subsetRefs": [{
                "subsetId": source.id,
                "percentage": 100,
                "excludeSources": ["MADE_UP_SOURCE"],
            }]
        }

        resp = client.patch(
            f"/subsets/{target.id}/config",
            json={"puzzleCount": 10, "config": config},
        )

        assert resp.status_code == 422

    def test_rejects_non_list_exclude_sources(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "pces_nonlist")
        _login(client, user.id)
        target = _make_subset(db_session, user, puzzle_count=10)
        source = _make_subset(db_session, user)
        _lock_subset(db_session, source)
        config = {
            "subsetRefs": [{
                "subsetId": source.id,
                "percentage": 100,
                "excludeSources": "LICHESS_TACTIC",
            }]
        }

        resp = client.patch(
            f"/subsets/{target.id}/config",
            json={"puzzleCount": 10, "config": config},
        )

        assert resp.status_code == 422


# ── Service: _sample_decoys — malformed acceptedMovesCounts ──────────────────────

@pytest.mark.integration
class TestSampleDecoysEdgeCases:
    def test_string_counts_are_ignored_returning_all(self, db_session) -> None:
        from app.services.subset import _sample_decoys
        user = _make_user(db_session, "sdec_strcount")
        subset = _make_subset(db_session, user)
        d3 = _make_decoy(db_session)
        d5 = _make_decoy(db_session, accepted_moves=[
            {"uci": f"e{i}e{i+1}", "cp": 30 - i, "drop_cp": 10}
            for i in range(5)
        ])

        ids = _sample_decoys({"acceptedMovesCounts": ["3", "5"]}, subset.id, 10)

        assert d3.id in ids
        assert d5.id in ids

    def test_empty_accepted_moves_counts_returns_all(self, db_session) -> None:
        from app.services.subset import _sample_decoys
        user = _make_user(db_session, "sdec_emptycounts")
        subset = _make_subset(db_session, user)
        d3 = _make_decoy(db_session)
        d5 = _make_decoy(db_session, accepted_moves=[
            {"uci": f"e{i}e{i+1}", "cp": 30 - i, "drop_cp": 10}
            for i in range(5)
        ])

        ids = _sample_decoys({"acceptedMovesCounts": []}, subset.id, 10)

        assert d3.id in ids
        assert d5.id in ids
