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
- **Raise typed exceptions from services.** Use `AppError` subclasses from `backend/app/exceptions.py` — never raw Python builtins. See `backend/AGENTS.md` for the full hierarchy.
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
- API calls go through `src/lib/request.ts` which wraps `fetch` with `credentials: 'same-origin'`. No external HTTP client. See `frontend/AGENTS.md` for error handling conventions.

### Testing

- Backend: pytest. New service functions need tests. Integration tests that require a live DB must be marked `@pytest.mark.integration`.
- Frontend: Vitest + `@testing-library/react`. Test files go in `src/test/` or a local `__tests__/` folder.

**Full suite (matches CI, use for final verification):**

- `make test` — unit tests for both backend and frontend inside Docker.
- `make test-integration` — integration tests against a throwaway test DB.
- `make test-all` — everything.

**Faster inner loop (use during development):**

- `cd backend && make test` — backend unit tests only, using the local `.venv`.
- `cd backend && make test-integration` — backend integration tests (requires a running local DB).
- `cd frontend && make test` — frontend tests; the frontend Makefile handles Node version via `nvm` automatically.

### Commands

Use `make` targets at the repo root — run `make` or inspect the `Makefile` for the full list. Key areas:

- **Local dev** — `make up`, `make up-build`.
- **Tests** — `make test` runs unit tests; `make test-integration` adds DB-dependent tests; `make test-all` runs everything.
- **Migrations** — `make migrate msg="..."` to generate, `make migrate-upgrade` to apply.
- **Lint** — `make lint`.
- **Pipeline** — see `pipeline/AGENTS.md` and `pipeline/Makefile`.

### Error handling and Sentry

Error handling is a cross-cutting concern with a deliberate contract. The backend returns `{"title": "...", "detail": "..."}` on every error; the frontend's `request()` intercepts every API error and owns all side effects. Neither side should re-surface errors that the other already handles.

Platform-specific rules live in the sub-guides:
- [`backend/AGENTS.md`](backend/AGENTS.md) — exception hierarchy, what to raise, what Sentry captures
- [`frontend/AGENTS.md`](frontend/AGENTS.md) — toast import, call-site patterns, what not to do

**Sentry environments:**

| Side | DSN variable | Environment tag |
|------|-------------|-----------------|
| Backend | `SENTRY_DSN` | `FLASK_ENV` (defaults to `"production"`) |
| Frontend | `VITE_SENTRY_DSN` | Vite `import.meta.env.MODE` |

Both sides are disabled when the DSN is unset — local development has no DSN by default.

### What to avoid

- No DB queries in route handlers.
- No inline styles in JSX.
- No `any` in TypeScript.
- No editing of existing Alembic migration files.
- No committing `.env`, secrets, or local paths.
- Do not move pipeline/ingestion logic back into the Flask backend.

## Workflows

### Making a schema migration

1. Edit the ORM model(s) in `backend/app/models/`.
2. Run `make migrate msg="short description"` to auto-generate the migration in `backend/migrations/versions/`.
3. Review the generated file — confirm the `upgrade()` and `downgrade()` functions match what you intended.
4. Run `make migrate-upgrade` to apply it locally.
5. Commit both the model change and the migration file together.

Rules:

- Never hand-edit an existing migration file. Generate a new one to fix mistakes.
- Bulk inserts inside migrations must use `sa.text()` with named params and a list of dicts — not the ORM layer.
- The migration must be safe for a fresh DB (no assumptions about existing data) unless the PR description explicitly states otherwise.

### UI inspection with Playwright (dev session)

The backend provides a standalone script that generates a signed Flask session cookie for any user in the DB, bypassing Lichess OAuth. Nothing goes over HTTP — the cookie is produced locally and injected directly into the Playwright browser.

**Generate a session cookie:**

```bash
make -C backend dev-session USERNAME=<lichess_username>
# prints a signed session cookie value to stdout
```

Requires `.env` at the project root with `SECRET_KEY`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` set (the Make target loads them automatically).

**Workflow (for Claude):**

1. Tell Claude which Lichess username to use (e.g. "log in as `brandows`").
2. Claude runs `make -C backend dev-session USERNAME=brandows` via Bash and captures the output.
3. Claude injects the cookie into the Playwright browser via `browser_evaluate`:

   ```js
   document.cookie = 'session=<value>; path=/'
   ```

4. Claude navigates to `/app` and inspects the authenticated shell.

See `docs/adr/0005-dev-login-endpoint-for-playwright.md` for the full rationale.

### Working with AI on a new feature

Use the skill chain in `.claude/skills/`:

1. **`/grill-with-docs`** — interview yourself about the feature until terms, constraints, and edge cases are sharp. Updates `CONTEXT.md` inline.
2. **`/to-prd`** — produce a concise PRD from the grilled requirements.
3. **`/triage`** — break the PRD into a labelled GitHub Issue ready for implementation.
4. Implement (agent or human).
5. **`/handoff`** — summarise what changed for the next context window or reviewer.

For architecture questions use **`/improve-codebase-architecture`**. For PR review use **`/ultrareview`**.

## Agent skills

Project-specific agent skills live in `.claude/skills/`.

### Issue tracker

GitHub Issues for `gilbertbrandow/woodpecker`, using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles mapped to GitHub labels (`needs-triage`, `question`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo — `CONTEXT.md` at root, `docs/adr/` for architectural decisions. See `docs/agents/domain.md`.
