"""Typed read/write interface for Flask session auth state.

All auth state lives behind these functions. No other module should
access session["user_id"], session["pending_onboarding"], or
session["waitlisted_lichess_username"] directly.
"""
from __future__ import annotations

from typing import Literal, TypedDict

from flask import session


class ActiveState(TypedDict):
    kind: Literal["active"]
    user_id: int


class OnboardingState(TypedDict):
    kind: Literal["onboarding"]
    lichess_username: str
    avatar_url: str | None


class WaitlistedState(TypedDict):
    kind: Literal["waitlisted"]
    lichess_username: str


AuthState = ActiveState | OnboardingState | WaitlistedState | None


def set_active(user_id: int) -> None:
    session.pop("pending_onboarding", None)
    session.pop("waitlisted_lichess_username", None)
    session["user_id"] = user_id


def set_onboarding(lichess_username: str, avatar_url: str | None) -> None:
    session.pop("user_id", None)
    session.pop("waitlisted_lichess_username", None)
    session["pending_onboarding"] = {
        "lichess_username": lichess_username,
        "avatar_url": avatar_url,
    }


def set_waitlisted(lichess_username: str) -> None:
    session.pop("user_id", None)
    session.pop("pending_onboarding", None)
    session["waitlisted_lichess_username"] = lichess_username


def clear() -> None:
    session.clear()


def read() -> AuthState:
    user_id = session.get("user_id")
    if user_id is not None:
        return {"kind": "active", "user_id": int(user_id)}

    pending = session.get("pending_onboarding")
    if pending is not None:
        return {
            "kind": "onboarding",
            "lichess_username": pending["lichess_username"],
            "avatar_url": pending.get("avatar_url"),
        }

    waitlisted = session.get("waitlisted_lichess_username")
    if waitlisted is not None:
        return {"kind": "waitlisted", "lichess_username": waitlisted}

    return None
