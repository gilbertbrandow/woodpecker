# ADR 0021 — Superadmin stored as boolean column on User, not env var

## Status
Accepted

## Context
Issue #180 introduces a Superadmin role for 2–3 users who need access to the Admin Page (user list, waitlist view, whitelist CRUD). We needed to choose how to store and check this privilege.

Two candidates:
1. **Boolean column** (`is_superadmin`) on the `users` table, set via a deploy CLI command
2. **Environment variable** (e.g. `SUPERADMIN_USERS=simon,gilbert`) listing privileged Lichess usernames

The codebase already uses `MAX_USERS` as an env var for the User Cap and a deploy command (`whitelist-add`) for Whitelist management.

## Decision
Store `is_superadmin` as a boolean column on `User`, default `False`. Grant it via a deploy CLI command that sets the column directly, mirroring the `whitelist-add` pattern.

## Rationale
- **Env vars are stateless across config changes** — adding or removing a superadmin requires a container restart and coordination between deploy config and runtime state. A DB column takes effect immediately with no restart.
- **The existing pattern is DB-backed** — Whitelist is already a DB table managed by CLI, not an env var. Consistency matters more than minimising columns.
- **Simpler privilege check** — `user.is_superadmin` in the backend is a single attribute read, with no env parsing or username normalization at request time.

## Trade-offs rejected
An env var would have required no migration, but would have introduced a hybrid model where some access control (User Cap) is config-driven and some (Superadmin) is DB-driven — creating two mental models for the same operator task.
