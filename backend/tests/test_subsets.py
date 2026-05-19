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
    WHERE config IS NOT NULL
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

        assert resp.status_code == 400
        assert "100" in resp.get_json()["error"]

    def test_rejects_missing_sources_key(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "pc_nosrc")
        _login(client, user.id)
        subset = _make_subset(db_session, user)

        resp = client.patch(
            f"/subsets/{subset.id}/config",
            json={"puzzleCount": 10, "config": {"rating": {"min": 0, "max": 9999}}},
        )

        assert resp.status_code == 400

    def test_rejects_unknown_source_name(self, client: FlaskClient, db_session) -> None:
        user = _make_user(db_session, "pc_unknownsrc")
        _login(client, user.id)
        subset = _make_subset(db_session, user)
        config = {"sources": [{"source": "MADE_UP_SOURCE", "percentage": 100, "config": {}}]}

        resp = client.patch(
            f"/subsets/{subset.id}/config",
            json={"puzzleCount": 10, "config": config},
        )

        assert resp.status_code == 400

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

        assert resp.status_code == 400

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
