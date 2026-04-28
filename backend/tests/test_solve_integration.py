import pytest
from flask.testing import FlaskClient
from tests.conftest import _seed_world  # type: ignore[import]


@pytest.mark.integration
class TestSolveHappyPath:
    def test_complete_with_solution_move_returns_solved(
        self, client: FlaskClient, db_session
    ) -> None:
        world = _seed_world(db_session)

        with client.session_transaction() as sess:
            sess["user_id"] = world["user_id"]

        run_id = world["run_id"]
        run_puzzle_id = world["run_puzzle_id"]
        attempt_id = world["attempt_id"]
        player_move = world["solution_player_move"]

        resp = client.post(
            f"/runs/{run_id}/puzzles/{run_puzzle_id}/attempts/{attempt_id}/complete",
            json={"uciMoves": [player_move], "clientTimeSpentMs": 3000},
        )

        assert resp.status_code == 200
        body = resp.get_json()

        assert body["outcome"] == "solved"
        assert body["completedAttemptId"] == attempt_id

        from app.models.run import PuzzleAttempt
        attempt_row = db_session.get(PuzzleAttempt, attempt_id)
        assert attempt_row is not None
        assert attempt_row.status == "solved"
        assert attempt_row.time_spent_ms == 3000
        assert attempt_row.moves == [player_move]

        overview = body["overview"]
        assert "puzzle" in overview
        assert "attempts" in overview
        assert "stats" in overview
        assert "progress" in overview
        assert "actions" in overview

        attempt_ids_in_overview = [a["id"] for a in overview["attempts"]]
        assert attempt_id in attempt_ids_in_overview

        assert overview.get("selectedAttemptId") == attempt_id

        assert "nextPuzzle" in overview["actions"]

        pgn = None
        for attempt_view in overview["attempts"]:
            if attempt_view["id"] == attempt_id:
                pgn = attempt_view.get("pgnDisplay")
                break
        assert pgn is not None
        mainline = pgn["mainline"]
        assert len(mainline) >= 2
        assert mainline[0]["moveStatus"] == "opponent"
        assert mainline[1]["moveStatus"] == "correct"
        assert mainline[1]["uci"] == player_move


@pytest.mark.integration
class TestCheckmateAlternative:
    def test_checkmate_alternative_scores_as_solved(
        self, client: FlaskClient, db_session
    ) -> None:
        world = _seed_world(db_session)

        with client.session_transaction() as sess:
            sess["user_id"] = world["user_id"]

        run_id = world["run_id"]
        run_puzzle_id = world["run_puzzle_id"]
        attempt_id = world["attempt_id"]
        alt_move = world["checkmate_alt_move"]
        solution_move = world["solution_player_move"]

        assert alt_move != solution_move

        resp = client.post(
            f"/runs/{run_id}/puzzles/{run_puzzle_id}/attempts/{attempt_id}/complete",
            json={"uciMoves": [alt_move], "clientTimeSpentMs": 5000},
        )

        assert resp.status_code == 200
        body = resp.get_json()

        assert body["outcome"] == "solved", (
            f"Expected 'solved' for checkmate alternative {alt_move!r}, got {body['outcome']!r}. "
            f"Solution move was {solution_move!r}."
        )

        from app.models.run import PuzzleAttempt
        attempt_row = db_session.get(PuzzleAttempt, attempt_id)
        assert attempt_row is not None
        assert attempt_row.moves == [alt_move]

        overview = body["overview"]
        pgn = None
        for attempt_view in overview["attempts"]:
            if attempt_view["id"] == attempt_id:
                pgn = attempt_view.get("pgnDisplay")
                break

        assert pgn is not None, "pgnDisplay missing from overview attempt"
        mainline = pgn["mainline"]

        player_plies = [m for m in mainline if m["moveStatus"] != "opponent"]
        assert len(player_plies) >= 1

        actual_uci = player_plies[0]["uci"]
        assert actual_uci == alt_move, (
            f"pgnDisplay shows {actual_uci!r} but player played {alt_move!r}. "
            f"The solution move {solution_move!r} must not appear as the player ply."
        )


@pytest.mark.integration
class TestAuthProtection:
    def test_complete_without_session_returns_401(
        self, client: FlaskClient, db_session
    ) -> None:
        world = _seed_world(db_session)

        resp = client.post(
            f"/runs/{world['run_id']}/puzzles/{world['run_puzzle_id']}"
            f"/attempts/{world['attempt_id']}/complete",
            json={"uciMoves": ["a1a8"], "clientTimeSpentMs": 1000},
        )

        assert resp.status_code == 401


@pytest.mark.integration
class TestFailedAttempt:
    def test_complete_with_wrong_move_returns_failed(
        self, client: FlaskClient, db_session
    ) -> None:
        world = _seed_world(db_session)

        with client.session_transaction() as sess:
            sess["user_id"] = world["user_id"]

        run_id = world["run_id"]
        run_puzzle_id = world["run_puzzle_id"]
        attempt_id = world["attempt_id"]

        wrong_move = "a1b1"

        resp = client.post(
            f"/runs/{run_id}/puzzles/{run_puzzle_id}/attempts/{attempt_id}/complete",
            json={"uciMoves": [wrong_move], "clientTimeSpentMs": 2000},
        )

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["outcome"] == "failed"

        overview = body["overview"]
        matching = [a for a in overview["attempts"] if a["id"] == attempt_id]
        assert len(matching) == 1
        assert matching[0]["status"] == "failed"

        from app.models.run import PuzzleAttempt
        attempt_row = db_session.get(PuzzleAttempt, attempt_id)
        assert attempt_row is not None
        assert attempt_row.status == "failed"
