# Agent Guide

This repo implements the Woodpecker Method for chess tactics training. Three main code areas:

- `backend/` — Flask, SQLAlchemy, Alembic, PostgreSQL.
- `frontend/` — React, TypeScript, Vite.
- `pipeline/` — standalone Python CLI for data import and source ingestion.

See `CONTEXT.md` for the domain glossary. See `pipeline/AGENTS.md` for pipeline-specific guidance.

## Coding conventions

### Architecture

- **Routes only do HTTP.** Parse the request, call a service function, return JSON. No business logic or DB queries in route handlers.
- **Services own business logic.** All validation, DB reads/writes, and error raising happen in `backend/app/services/`.
- **Models are plain ORM.** No business logic in `backend/app/models/`.
- **Raise typed exceptions from services.** Routes map them to HTTP codes:
  - `LookupError` → 404
  - `PermissionError` → 403
  - `ValueError` → 400 (use 409 for specific conflict messages)
- **Import/ingestion logic belongs in `pipeline/`, not the Flask backend.**

### Schema changes

- Always use Alembic (Flask-Migrate) for schema changes. Never modify ORM models without a matching migration.
- Generate with `make migrate msg="..."`, apply with `make migrate-upgrade`.
- Never edit existing migration files. Create a new one to correct mistakes.
- Migrations must be safe for a fresh database and for existing production-like data.

### Python

- Python 3.12. Full mypy-compatible type annotations on all functions and class attributes.
- `snake_case` for Python identifiers, `camelCase` for all JSON response keys.
- Use `ruff` for linting. No unused imports, no bare `except`.
- When accessing `schedule.config` (a `dict[str, object]`), always validate types with `isinstance` before use.

### Frontend

- TypeScript only. No `any`. Use `unknown` + type narrowing where needed.
- Routing via TanStack Router (`@tanstack/react-router`). All routes defined in `frontend/src/router.tsx`.
- UI primitives from Radix UI (`@radix-ui/*`), wrapped in `frontend/src/components/ui/`.
- Styling with Tailwind CSS. No inline styles. Use the `cn()` helper from `src/lib/utils` for conditional classes.
- API calls use plain `fetch` with `credentials: 'include'`. No external HTTP client.

### Testing

- Backend: pytest. New service functions need tests. Integration tests that require a live DB must be marked `@pytest.mark.integration`.
- Frontend: Vitest + `@testing-library/react`. Test files go in `src/test/` or a local `__tests__/` folder.
- Run backend tests: `cd backend && .venv/bin/pytest -m "not integration"`
- Run frontend tests: `cd frontend && npm run test:run`

### Commands

Use `make` targets at the repo root — run `make` or inspect the `Makefile` for the full list. Key areas:

- **Local dev** — `make up`, `make up-build`.
- **Tests** — `make test` runs unit tests; `make test-integration` adds DB-dependent tests; `make test-all` runs everything.
- **Migrations** — `make migrate msg="..."` to generate, `make migrate-upgrade` to apply.
- **Lint** — `make lint`.
- **Pipeline** — see `pipeline/AGENTS.md` and `pipeline/Makefile`.

### What to avoid

- No DB queries in route handlers.
- No inline styles in JSX.
- No `any` in TypeScript.
- No editing of existing Alembic migration files.
- No committing `.env`, secrets, or local paths.
- Do not move pipeline/ingestion logic back into the Flask backend.

## Agent skills

Project-specific agent skills live in `.claude/skills/`.

### Issue tracker

GitHub Issues for `gilbertbrandow/woodpecker`, using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles mapped to GitHub labels (`needs-triage`, `question`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo — `CONTEXT.md` at root, `docs/adr/` for architectural decisions. See `docs/agents/domain.md`.
