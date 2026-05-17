"""Tests for the new user flow: cap, whitelist, waitlist, display name, onboarding."""
import os
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock

import pytest
import sqlalchemy as sa
from flask import Flask
from flask.testing import FlaskClient

from app import auth_session
from app.models.user import User, WaitlistEntry, WhitelistEntry
from app.services.validation import validate_display_name
from app.services.auth_service import decide_access


# ── Access decision (pure, no DB) ─────────────────────────────────────────────

class TestDecideAccess:
    def test_below_cap_gets_onboarding(self) -> None:
        assert decide_access(active_count=4, max_users=5, in_whitelist=False) == "onboarding"

    def test_at_cap_gets_waitlisted(self) -> None:
        assert decide_access(active_count=5, max_users=5, in_whitelist=False) == "waitlisted"

    def test_over_cap_gets_waitlisted(self) -> None:
        assert decide_access(active_count=10, max_users=5, in_whitelist=False) == "waitlisted"

    def test_zero_max_users_waitlists_everyone(self) -> None:
        assert decide_access(active_count=0, max_users=0, in_whitelist=False) == "waitlisted"

    def test_whitelisted_bypasses_full_cap(self) -> None:
        assert decide_access(active_count=5, max_users=5, in_whitelist=True) == "onboarding"

    def test_whitelisted_bypasses_zero_cap(self) -> None:
        assert decide_access(active_count=0, max_users=0, in_whitelist=True) == "onboarding"


# ── Display name validation ───────────────────────────────────────────────────

class TestDisplayNameValidation:
    def test_valid_simple(self) -> None:
        assert validate_display_name("Alice") == "Alice"

    def test_valid_with_spaces(self) -> None:
        assert validate_display_name("Alice Smith") == "Alice Smith"

    def test_valid_with_underscore_hyphen(self) -> None:
        assert validate_display_name("alice_smith-1") == "alice_smith-1"

    def test_strips_whitespace(self) -> None:
        assert validate_display_name("  Alice  ") == "Alice"

    def test_min_length(self) -> None:
        assert validate_display_name("ab") == "ab"

    def test_too_short(self) -> None:
        with pytest.raises(ValueError, match="at least 2"):
            validate_display_name("a")

    def test_empty(self) -> None:
        with pytest.raises(ValueError, match="empty"):
            validate_display_name("")

    def test_whitespace_only(self) -> None:
        with pytest.raises(ValueError, match="empty"):
            validate_display_name("   ")

    def test_too_long(self) -> None:
        with pytest.raises(ValueError, match="32 characters"):
            validate_display_name("a" * 33)

    def test_max_length_ok(self) -> None:
        assert validate_display_name("a" * 32) == "a" * 32

    def test_invalid_chars(self) -> None:
        with pytest.raises(ValueError):
            validate_display_name("alice@domain")

    def test_invalid_chars_dot(self) -> None:
        with pytest.raises(ValueError):
            validate_display_name("alice.smith")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_lichess_mock(username: str, avatar: str | None = None) -> MagicMock:
    mock_client = MagicMock()
    mock_client.account.get.return_value = {"username": username, "avatar": avatar}
    return mock_client


def _patch_berserk(mock_client: MagicMock):  # type: ignore[misc]
    """Patch both TokenSession and Client in auth_service."""
    import contextlib

    @contextlib.contextmanager
    def _ctx():  # type: ignore[misc]
        with patch("app.services.auth_service.berserk.TokenSession"), \
             patch("app.services.auth_service.berserk.Client", return_value=mock_client):
            yield

    return _ctx()


# ── Cap behavior ──────────────────────────────────────────────────────────────

class TestCapBehavior:
    def test_user_below_cap_gets_onboarding(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        with patch.dict(os.environ, {"MAX_USERS": "5"}):
            with _patch_berserk(_make_lichess_mock("newuser1")):
                from app.services.auth_service import get_or_create_user
                result = get_or_create_user("fake_token")
                assert result["status"] == "onboarding"
                assert result["lichess_username"] == "newuser1"

    def test_user_at_cap_gets_waitlisted(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        for i in range(3):
            user = User(
                lichess_username=f"capuser{i}",
                display_name=f"Cap User {i}",
                created_at=datetime.now(timezone.utc),
            )
            db_session.add(user)
        db_session.commit()

        with patch.dict(os.environ, {"MAX_USERS": "3"}):
            with _patch_berserk(_make_lichess_mock("newcomer")):
                from app.services.auth_service import get_or_create_user
                result = get_or_create_user("fake_token")
                assert result["status"] == "waitlisted"

    def test_zero_max_users_waitlists_everyone(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        with patch.dict(os.environ, {"MAX_USERS": "0"}):
            with _patch_berserk(_make_lichess_mock("zeroucap")):
                from app.services.auth_service import get_or_create_user
                result = get_or_create_user("fake_token")
                assert result["status"] == "waitlisted"


# ── Whitelist bypass ──────────────────────────────────────────────────────────

class TestWhitelistBypass:
    def test_whitelisted_user_bypasses_cap(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        for i in range(5):
            user = User(
                lichess_username=f"wlcapuser{i}",
                display_name=f"WL Cap User {i}",
                created_at=datetime.now(timezone.utc),
            )
            db_session.add(user)
        entry = WhitelistEntry(
            lichess_username="wlspecial",
            created_at=datetime.now(timezone.utc),
        )
        db_session.add(entry)
        db_session.commit()

        with patch.dict(os.environ, {"MAX_USERS": "5"}):
            with _patch_berserk(_make_lichess_mock("wlspecial")):
                from app.services.auth_service import get_or_create_user
                result = get_or_create_user("fake_token")
                assert result["status"] == "onboarding"

    def test_whitelist_lookup_is_case_insensitive(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        # Whitelist stores lowercase; Lichess returns canonical mixed-case username.
        # The whitelist check must still match.
        entry = WhitelistEntry(
            lichess_username="wlmixed",
            created_at=datetime.now(timezone.utc),
        )
        db_session.add(entry)
        db_session.commit()

        with patch.dict(os.environ, {"MAX_USERS": "0"}):
            with _patch_berserk(_make_lichess_mock("WlMixed")):
                from app.services.auth_service import get_or_create_user
                result = get_or_create_user("fake_token")
                assert result["status"] == "onboarding"


# ── Existing user always active ───────────────────────────────────────────────

class TestExistingUserAlwaysActive:
    def test_existing_user_always_active(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        for i in range(10):
            user = User(
                lichess_username=f"existingcap{i}",
                display_name=f"Existing Cap {i}",
                created_at=datetime.now(timezone.utc),
            )
            db_session.add(user)
        db_session.commit()

        with patch.dict(os.environ, {"MAX_USERS": "1"}):
            with _patch_berserk(_make_lichess_mock("existingcap0")):
                from app.services.auth_service import get_or_create_user
                result = get_or_create_user("fake_token")
                assert result["status"] == "active"

    def test_returning_user_casing_is_preserved(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        # Regression: .lower() on the Lichess username broke lookup for users
        # stored with canonical Lichess casing (e.g. "ChessUser" != "chessuser").
        user = User(
            lichess_username="ChessUser",
            display_name="ChessUser",
            created_at=datetime.now(timezone.utc),
        )
        db_session.add(user)
        db_session.commit()

        with patch.dict(os.environ, {"MAX_USERS": "1"}):
            with _patch_berserk(_make_lichess_mock("ChessUser")):
                from app.services.auth_service import get_or_create_user
                result = get_or_create_user("fake_token")
                assert result["status"] == "active"
                assert result["user_id"] == user.id


# ── Waitlist idempotency ──────────────────────────────────────────────────────

class TestWaitlistIdempotency:
    def test_two_logins_produce_one_waitlist_row(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        for i in range(3):
            user = User(
                lichess_username=f"idempuser{i}",
                display_name=f"Idemp User {i}",
                created_at=datetime.now(timezone.utc),
            )
            db_session.add(user)
        db_session.commit()

        with patch.dict(os.environ, {"MAX_USERS": "3"}):
            with _patch_berserk(_make_lichess_mock("idempwaiter")):
                from app.services.auth_service import get_or_create_user
                get_or_create_user("token1")
            with _patch_berserk(_make_lichess_mock("idempwaiter")):
                get_or_create_user("token2")

        count = db_session.execute(
            sa.select(sa.func.count()).select_from(WaitlistEntry).where(
                WaitlistEntry.lichess_username == "idempwaiter"
            )
        ).scalar()
        assert count == 1


# ── Onboarding endpoint ───────────────────────────────────────────────────────

class TestOnboardingEndpoint:
    def test_onboarding_creates_user(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["pending_onboarding"] = {
                    "lichess_username": "onboardme",
                    "avatar_url": None,
                }

            response = client.post(
                "/auth/onboarding",
                json={"displayName": "Onboard Me"},
                content_type="application/json",
            )
            assert response.status_code == 200
            data = response.get_json()
            assert data["status"] == "active"
            assert data["displayName"] == "Onboard Me"
            assert data["username"] == "onboardme"

    def test_onboarding_invalid_display_name(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["pending_onboarding"] = {
                    "lichess_username": "onboardbad",
                    "avatar_url": None,
                }

            response = client.post(
                "/auth/onboarding",
                json={"displayName": "x"},
                content_type="application/json",
            )
            assert response.status_code == 400

    def test_onboarding_requires_session(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        with app.test_client() as client:
            response = client.post(
                "/auth/onboarding",
                json={"displayName": "Valid Name"},
                content_type="application/json",
            )
            assert response.status_code == 401


# ── API response privacy ──────────────────────────────────────────────────────

class TestApiResponsePrivacy:
    def test_leaderboard_does_not_contain_lichess_username(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        with app.test_client() as client:
            response = client.get("/leaderboard")
            assert response.status_code == 200
            data = response.get_json()
            for run in data.get("runs", []):
                assert "lichess_username" not in run
                assert "username" not in run

    def test_participants_does_not_contain_lichess_username(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        world = _seed_participants(db_session)

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = world["user_id"]

            response = client.get(f"/schedules/{world['schedule_id']}/training/participants")
            assert response.status_code == 200
            data = response.get_json()
            for participant in data.get("participants", []):
                assert "lichess_username" not in participant
                assert "username" not in participant


# ── Auth session state machine ────────────────────────────────────────────────

class TestAuthSession:
    def test_anonymous_is_none(self, app: Flask) -> None:
        with app.test_request_context("/"):
            assert auth_session.read() is None

    def test_set_active(self, app: Flask) -> None:
        with app.test_request_context("/"):
            auth_session.set_active(42)
            assert auth_session.read() == {"kind": "active", "user_id": 42}

    def test_set_onboarding(self, app: Flask) -> None:
        with app.test_request_context("/"):
            auth_session.set_onboarding("ChessUser", "https://example.com/avatar.jpg")
            assert auth_session.read() == {
                "kind": "onboarding",
                "lichess_username": "ChessUser",
                "avatar_url": "https://example.com/avatar.jpg",
            }

    def test_set_onboarding_null_avatar(self, app: Flask) -> None:
        with app.test_request_context("/"):
            auth_session.set_onboarding("ChessUser", None)
            state = auth_session.read()
            assert state is not None
            assert state["kind"] == "onboarding"
            assert state["avatar_url"] is None  # type: ignore[typeddict-item]

    def test_set_waitlisted(self, app: Flask) -> None:
        with app.test_request_context("/"):
            auth_session.set_waitlisted("ChessUser")
            assert auth_session.read() == {"kind": "waitlisted", "lichess_username": "ChessUser"}

    def test_clear_resets_to_none(self, app: Flask) -> None:
        with app.test_request_context("/"):
            auth_session.set_active(42)
            auth_session.clear()
            assert auth_session.read() is None

    def test_set_active_clears_onboarding(self, app: Flask) -> None:
        with app.test_request_context("/"):
            auth_session.set_onboarding("ChessUser", None)
            auth_session.set_active(42)
            assert auth_session.read() == {"kind": "active", "user_id": 42}

    def test_set_active_clears_waitlisted(self, app: Flask) -> None:
        with app.test_request_context("/"):
            auth_session.set_waitlisted("ChessUser")
            auth_session.set_active(42)
            assert auth_session.read() == {"kind": "active", "user_id": 42}

    def test_set_onboarding_clears_active(self, app: Flask) -> None:
        with app.test_request_context("/"):
            auth_session.set_active(42)
            auth_session.set_onboarding("ChessUser", None)
            state = auth_session.read()
            assert state is not None
            assert state["kind"] == "onboarding"

    def test_set_waitlisted_clears_active(self, app: Flask) -> None:
        with app.test_request_context("/"):
            auth_session.set_active(42)
            auth_session.set_waitlisted("ChessUser")
            state = auth_session.read()
            assert state is not None
            assert state["kind"] == "waitlisted"


def _seed_participants(db_session) -> dict[str, object]:  # type: ignore[misc]
    from app.models.subset import Subset
    from app.models.schedule import Schedule
    from app.models.training import Training

    user = User(
        lichess_username="participanttest",
        display_name="Participant Test",
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(user)
    db_session.flush()

    subset = Subset(
        user_id=user.id,
        name="Priv Subset",
        puzzle_count=1,
        locked_at=datetime.now(timezone.utc),
        locked_puzzle_count=1,
    )
    db_session.add(subset)
    db_session.flush()

    schedule = Schedule(
        user_id=user.id,
        subset_id=subset.id,
        name="Priv Schedule",
        config={"runs": [], "puzzle_order": "fixed", "failed_repetition": {"mode": "none"}},
        locked_at=datetime.now(timezone.utc),
    )
    db_session.add(schedule)
    db_session.flush()

    training = Training(
        user_id=user.id,
        schedule_id=schedule.id,
        started_at=datetime.now(timezone.utc),
    )
    db_session.add(training)
    db_session.flush()
    db_session.commit()

    return {
        "user_id": user.id,
        "schedule_id": schedule.id,
        "training_id": training.id,
    }
