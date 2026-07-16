"""
Selector-compatible entity contract.

Any entity that can be used in a frontend entity-selector component must expose
three endpoints following this pattern:

  GET /entity/suggest?limit=N   → list[SelectorOut]   recently-relevant items
  GET /entity/search?q=&limit=N → list[SelectorOut]   name-search results
  GET /entity/by-ids?ids=1,2,3  → list[SelectorOut]   hydrate ids from URL state

Currently-selectable entities: User, Subset, Schedule.

The two concrete selector shapes are defined below. They are intentionally
separate because the frontend renders them differently (avatar vs icon, with or
without a status badge), but both share the `id: int` key so generic toggle /
remove logic is uniform.
"""

from typing import TypedDict


class NamedSelectorOut(TypedDict):
    """Selector shape for entities identified by a name and a lifecycle status."""
    id: int
    name: str
    status: str


class UserSelectorOut(TypedDict):
    """Selector shape for users, which carry an avatar and use displayName."""
    id: int
    displayName: str
    avatarUrl: str | None
