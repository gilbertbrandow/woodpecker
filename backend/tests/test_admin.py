"""Tests for admin routes and admin_required decorator."""
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock

import pytest
import sqlalchemy as sa
from flask import Flask

from app.models.user import User, WaitlistEntry, WhitelistEntry


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_user(db_session, *, username: str, is_superadmin: bool = False) -> User:
    user = User(
        lichess_username=username,
        display_name=username,
        is_superadmin=is_superadmin,
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(user)
    db_session.flush()
    return user


def _make_waitlist(db_session, *, username: str) -> WaitlistEntry:
    entry = WaitlistEntry(
        lichess_username=username,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db_session.add(entry)
    db_session.flush()
    return entry


def _make_whitelist(db_session, *, username: str) -> WhitelistEntry:
    entry = WhitelistEntry(lichess_username=username, created_at=datetime.now(timezone.utc))
    db_session.add(entry)
    db_session.flush()
    return entry


def _make_lichess_mock(username: str) -> MagicMock:
    mock_client = MagicMock()
    mock_client.account.get.return_value = {"username": username, "avatar": None}
    return mock_client


def _patch_berserk(mock_client: MagicMock):  # type: ignore[misc]
    import contextlib

    @contextlib.contextmanager
    def _ctx():  # type: ignore[misc]
        with patch("app.services.auth_service.berserk.TokenSession"), \
             patch("app.services.auth_service.berserk.Client", return_value=mock_client):
            yield

    return _ctx()


# ── admin_required ────────────────────────────────────────────────────────────

@pytest.mark.integration
class TestAdminRequired:
    def test_unauthenticated_gets_401(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        with app.test_client() as client:
            response = client.get("/admin/users")
        assert response.status_code == 401

    def test_regular_user_gets_403(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        user = _make_user(db_session, username="regularuser")
        db_session.commit()
        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = user.id
            response = client.get("/admin/users")
        assert response.status_code == 403

    def test_superadmin_gets_through(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        user = _make_user(db_session, username="adminuser", is_superadmin=True)
        db_session.commit()
        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = user.id
            response = client.get("/admin/users")
        assert response.status_code == 200


# ── GET /admin/stats ──────────────────────────────────────────────────────────

@pytest.mark.integration
class TestAdminStats:
    def test_returns_all_counts(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        admin = _make_user(db_session, username="statsadmin", is_superadmin=True)
        _make_user(db_session, username="statsuser")
        _make_waitlist(db_session, username="statswaiter")
        _make_whitelist(db_session, username="statsvip")
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = admin.id
            response = client.get("/admin/stats")

        assert response.status_code == 200
        data = response.get_json()
        assert data["activeUserCount"] == 2
        assert data["waitlistCount"] == 1
        assert data["whitelistCount"] == 1
        assert "maxUsers" in data

    def test_max_users_zero_when_env_unset(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        admin = _make_user(db_session, username="statsenvadmin", is_superadmin=True)
        db_session.commit()

        with patch.dict("os.environ", {"MAX_USERS": ""}):
            with app.test_client() as client:
                with client.session_transaction() as sess:
                    sess["user_id"] = admin.id
                response = client.get("/admin/stats")

        assert response.get_json()["maxUsers"] == 0

    def test_max_users_from_env(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        admin = _make_user(db_session, username="statsenvadmin2", is_superadmin=True)
        db_session.commit()

        with patch.dict("os.environ", {"MAX_USERS": "50"}):
            with app.test_client() as client:
                with client.session_transaction() as sess:
                    sess["user_id"] = admin.id
                response = client.get("/admin/stats")

        assert response.get_json()["maxUsers"] == 50


# ── GET /admin/users ──────────────────────────────────────────────────────────

@pytest.mark.integration
class TestAdminUsers:
    def test_returns_all_users(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        admin = _make_user(db_session, username="theadmin", is_superadmin=True)
        _make_user(db_session, username="playerone")
        _make_user(db_session, username="playertwo")
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = admin.id
            response = client.get("/admin/users")

        assert response.status_code == 200
        data = response.get_json()
        assert data["total"] == 3
        assert len(data["items"]) == 3

    def test_response_shape(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        admin = _make_user(db_session, username="shapeadmin", is_superadmin=True)
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = admin.id
            response = client.get("/admin/users")

        item = response.get_json()["items"][0]
        assert "id" in item
        assert "lichessUsername" in item
        assert "displayName" in item
        assert "createdAt" in item
        assert "lastLoginAt" in item
        assert "lastSeenAt" in item
        assert "isSuperAdmin" in item

    def test_search_filters_by_username(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        admin = _make_user(db_session, username="searchadmin", is_superadmin=True)
        _make_user(db_session, username="alphaplayer")
        _make_user(db_session, username="betaplayer")
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = admin.id
            response = client.get("/admin/users?q=alpha")

        data = response.get_json()
        assert data["total"] == 1
        assert data["items"][0]["lichessUsername"] == "alphaplayer"

    def test_search_is_case_insensitive(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        admin = _make_user(db_session, username="ciadmin", is_superadmin=True)
        _make_user(db_session, username="CamelUser")
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = admin.id
            response = client.get("/admin/users?q=camel")

        assert response.get_json()["total"] == 1

    def test_last_login_at_is_null(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        admin = _make_user(db_session, username="nullloginadmin", is_superadmin=True)
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = admin.id
            item = client.get("/admin/users").get_json()["items"][0]

        assert item["lastLoginAt"] is None

    def test_is_superadmin_flag_reflects_role(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        admin = _make_user(db_session, username="flagadmin", is_superadmin=True)
        _make_user(db_session, username="flagregular")
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = admin.id
            items = client.get("/admin/users").get_json()["items"]

        by_username = {i["lichessUsername"]: i for i in items}
        assert by_username["flagadmin"]["isSuperAdmin"] is True
        assert by_username["flagregular"]["isSuperAdmin"] is False


# ── GET /admin/waitlist ───────────────────────────────────────────────────────

@pytest.mark.integration
class TestAdminWaitlist:
    def test_returns_waitlist_entries(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        admin = _make_user(db_session, username="wladmin", is_superadmin=True)
        _make_waitlist(db_session, username="waitinguser")
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = admin.id
            response = client.get("/admin/waitlist")

        assert response.status_code == 200
        data = response.get_json()
        assert data["total"] == 1
        item = data["items"][0]
        assert item["lichessUsername"] == "waitinguser"
        assert "createdAt" in item
        assert "updatedAt" in item
        assert "isWhitelisted" in item

    def test_is_whitelisted_false_by_default(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        admin = _make_user(db_session, username="wliswhiteadmin", is_superadmin=True)
        _make_waitlist(db_session, username="pendinguser")
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = admin.id
            item = client.get("/admin/waitlist").get_json()["items"][0]

        assert item["isWhitelisted"] is False

    def test_is_whitelisted_true_when_whitelisted(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        admin = _make_user(db_session, username="wliswhitetrue", is_superadmin=True)
        _make_waitlist(db_session, username="vipwaiter")
        _make_whitelist(db_session, username="vipwaiter")
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = admin.id
            item = client.get("/admin/waitlist").get_json()["items"][0]

        assert item["isWhitelisted"] is True

    def test_empty_waitlist(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        admin = _make_user(db_session, username="wlemptyadmin", is_superadmin=True)
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = admin.id
            data = client.get("/admin/waitlist").get_json()

        assert data["total"] == 0
        assert data["items"] == []

    def test_search_filters_waitlist(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        admin = _make_user(db_session, username="wlsearchadmin", is_superadmin=True)
        _make_waitlist(db_session, username="waituser_alpha")
        _make_waitlist(db_session, username="waituser_beta")
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = admin.id
            data = client.get("/admin/waitlist?q=alpha").get_json()

        assert data["total"] == 1
        assert data["items"][0]["lichessUsername"] == "waituser_alpha"


# ── DELETE /admin/waitlist/<username> ─────────────────────────────────────────

@pytest.mark.integration
class TestAdminWaitlistDelete:
    def test_removes_entry(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        admin = _make_user(db_session, username="wldeladmin", is_superadmin=True)
        _make_waitlist(db_session, username="deletemewaiter")
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = admin.id
            assert client.delete("/admin/waitlist/deletemewaiter").status_code == 204
            assert client.get("/admin/waitlist").get_json()["total"] == 0

    def test_missing_entry_returns_404(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        admin = _make_user(db_session, username="wl404deladmin", is_superadmin=True)
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = admin.id
            assert client.delete("/admin/waitlist/ghost").status_code == 404

    def test_delete_is_case_insensitive(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        admin = _make_user(db_session, username="wlcasedeladmin", is_superadmin=True)
        _make_waitlist(db_session, username="casewaiter")
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = admin.id
            assert client.delete("/admin/waitlist/CaseWaiter").status_code == 204


# ── GET /admin/whitelist ──────────────────────────────────────────────────────

@pytest.mark.integration
class TestAdminWhitelistGet:
    def test_returns_whitelist_entries(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        admin = _make_user(db_session, username="wlgetadmin", is_superadmin=True)
        _make_whitelist(db_session, username="vipuser")
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = admin.id
            response = client.get("/admin/whitelist")

        data = response.get_json()
        assert data["total"] == 1
        item = data["items"][0]
        assert item["lichessUsername"] == "vipuser"
        assert "createdAt" in item
        assert "isRegistered" in item

    def test_is_registered_false_when_no_user(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        admin = _make_user(db_session, username="wlregfalseadmin", is_superadmin=True)
        _make_whitelist(db_session, username="notregistered")
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = admin.id
            item = client.get("/admin/whitelist").get_json()["items"][0]

        assert item["isRegistered"] is False

    def test_is_registered_true_when_user_exists(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        admin = _make_user(db_session, username="wlregtrue", is_superadmin=True)
        _make_user(db_session, username="registeredvip")
        _make_whitelist(db_session, username="registeredvip")
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = admin.id
            items = client.get("/admin/whitelist").get_json()["items"]

        registered = next(i for i in items if i["lichessUsername"] == "registeredvip")
        assert registered["isRegistered"] is True

    def test_search_filters_whitelist(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        admin = _make_user(db_session, username="wlsearchgetadmin", is_superadmin=True)
        _make_whitelist(db_session, username="alice")
        _make_whitelist(db_session, username="bob")
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = admin.id
            data = client.get("/admin/whitelist?q=ali").get_json()

        assert data["total"] == 1
        assert data["items"][0]["lichessUsername"] == "alice"


# ── POST /admin/whitelist ─────────────────────────────────────────────────────

@pytest.mark.integration
class TestAdminWhitelistAdd:
    def test_adds_entry(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        admin = _make_user(db_session, username="wladdadmin", is_superadmin=True)
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = admin.id
            response = client.post("/admin/whitelist", json={"lichessUsername": "NewVip"})

        assert response.status_code == 201
        data = response.get_json()
        assert data["lichessUsername"] == "newvip"
        assert "id" in data
        assert "createdAt" in data

    def test_normalises_to_lowercase(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        admin = _make_user(db_session, username="wllowadmin", is_superadmin=True)
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = admin.id
            client.post("/admin/whitelist", json={"lichessUsername": "MixedCase"})
            data = client.get("/admin/whitelist?q=mixedcase").get_json()

        assert data["total"] == 1

    def test_duplicate_returns_409(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        admin = _make_user(db_session, username="wldupadmin", is_superadmin=True)
        _make_whitelist(db_session, username="existing")
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = admin.id
            assert client.post("/admin/whitelist", json={"lichessUsername": "existing"}).status_code == 409

    def test_already_registered_user_returns_409(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        admin = _make_user(db_session, username="wlregadmin", is_superadmin=True)
        _make_user(db_session, username="activeuser")
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = admin.id
            response = client.post("/admin/whitelist", json={"lichessUsername": "activeuser"})

        assert response.status_code == 409

    def test_missing_body_returns_400(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        admin = _make_user(db_session, username="wlbodyadmin", is_superadmin=True)
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = admin.id
            assert client.post("/admin/whitelist", json={}).status_code == 400


# ── DELETE /admin/whitelist/<username> ────────────────────────────────────────

@pytest.mark.integration
class TestAdminWhitelistDelete:
    def test_removes_entry(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        admin = _make_user(db_session, username="wldeladmin", is_superadmin=True)
        _make_whitelist(db_session, username="deleteme")
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = admin.id
            assert client.delete("/admin/whitelist/deleteme").status_code == 204
            assert client.get("/admin/whitelist").get_json()["total"] == 0

    def test_missing_entry_returns_404(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        admin = _make_user(db_session, username="wl404admin", is_superadmin=True)
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = admin.id
            assert client.delete("/admin/whitelist/doesnotexist").status_code == 404

    def test_delete_is_case_insensitive(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        admin = _make_user(db_session, username="wlcasedeadmin", is_superadmin=True)
        _make_whitelist(db_session, username="casetest")
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = admin.id
            assert client.delete("/admin/whitelist/CaseTest").status_code == 204


# ── _upsert_waitlist behaviour ────────────────────────────────────────────────

@pytest.mark.integration
class TestUpsertWaitlist:
    def test_creates_entry_for_new_user(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        from app.services.auth_service import _upsert_waitlist
        _upsert_waitlist("brandnewuser")
        entry = db_session.execute(
            sa.select(WaitlistEntry).filter_by(lichess_username="brandnewuser")
        ).scalar_one_or_none()
        assert entry is not None

    def test_updates_updated_at_on_re_attempt(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        from app.services.auth_service import _upsert_waitlist
        # SQLite stores and returns naive datetimes; use UTC-naive for comparison
        original_time = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=1)
        entry = WaitlistEntry(
            lichess_username="retryuser",
            created_at=original_time,
            updated_at=original_time,
        )
        db_session.add(entry)
        db_session.commit()

        _upsert_waitlist("retryuser")

        db_session.refresh(entry)
        assert entry.updated_at > original_time
        assert entry.created_at == original_time  # created_at unchanged


# ── create_user_from_onboarding ───────────────────────────────────────────────

@pytest.mark.integration
class TestCreateUserFromOnboarding:
    def test_deletes_waitlist_entry_on_registration(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        from app.services.auth_service import create_user_from_onboarding
        _make_waitlist(db_session, username="newregistrant")
        db_session.commit()

        create_user_from_onboarding("newregistrant", "New Registrant", None)

        remaining = db_session.execute(
            sa.select(WaitlistEntry).filter_by(lichess_username="newregistrant")
        ).scalar_one_or_none()
        assert remaining is None

    def test_creates_user_when_no_waitlist_entry(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        from app.services.auth_service import create_user_from_onboarding
        user = create_user_from_onboarding("directuser", "Direct User", None)
        assert user.id is not None
        assert user.lichess_username == "directuser"


# ── stale waitlist session ────────────────────────────────────────────────────

@pytest.mark.integration
class TestStaleWaitlistSession:
    def test_me_clears_session_when_waitlist_entry_missing(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["waitlisted_lichess_username"] = "ghostuser"
            response = client.get("/auth/me")

        assert response.status_code == 401

    def test_me_returns_waitlisted_when_entry_exists(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        _make_waitlist(db_session, username="realwaiter")
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["waitlisted_lichess_username"] = "realwaiter"
            response = client.get("/auth/me")

        assert response.status_code == 200
        assert response.get_json()["status"] == "waitlisted"


# ── last_login_at ─────────────────────────────────────────────────────────────

@pytest.mark.integration
class TestLastLoginAt:
    def test_new_user_has_null_last_login(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        admin = _make_user(db_session, username="nullloginadmin2", is_superadmin=True)
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = admin.id
            item = client.get("/admin/users").get_json()["items"][0]

        assert item["lastLoginAt"] is None

    def test_returning_user_gets_last_login_set(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        _make_user(db_session, username="returninguser")
        db_session.commit()

        with _patch_berserk(_make_lichess_mock("returninguser")):
            from app.services.auth_service import get_or_create_user
            get_or_create_user("fake_token")

        from app.models.user import User as UserModel
        user = db_session.execute(
            sa.select(UserModel).filter_by(lichess_username="returninguser")
        ).scalar_one()
        db_session.refresh(user)
        assert user.last_login_at is not None

    def test_onboarding_does_not_create_user(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        with patch.dict("os.environ", {"MAX_USERS": "10"}):
            with _patch_berserk(_make_lichess_mock("freshonboarder")):
                from app.services.auth_service import get_or_create_user
                result = get_or_create_user("fake_token")

        assert result["status"] == "onboarding"
        count = db_session.scalar(
            sa.select(sa.func.count()).select_from(User).where(
                User.lichess_username == "freshonboarder"
            )
        )
        assert count == 0


# ── /auth/me includes isSuperAdmin ───────────────────────────────────────────

@pytest.mark.integration
class TestMeIncludesSuperAdmin:
    def test_regular_user_is_not_superadmin(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        user = _make_user(db_session, username="meregular")
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = user.id
            data = client.get("/auth/me").get_json()

        assert data["isSuperAdmin"] is False

    def test_superadmin_user_flag_is_true(self, app: Flask, db_session) -> None:  # type: ignore[misc]
        user = _make_user(db_session, username="mesuperadmin", is_superadmin=True)
        db_session.commit()

        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["user_id"] = user.id
            data = client.get("/auth/me").get_json()

        assert data["isSuperAdmin"] is True
