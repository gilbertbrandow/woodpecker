# Woodpecker – AI Agent Context

This file gives AI agents (Claude, GitHub Copilot, etc.) the orientation needed to work effectively in this repository. It is safe to commit; it contains no secrets or personal paths.

---

## What is Woodpecker?

Woodpecker is a web application for chess puzzle training based on the **Woodpecker Method** — a spaced-repetition technique where you solve the same set of puzzles repeatedly across multiple timed runs to build pattern recognition.

Users sign in via **Lichess OAuth** and create a **Subset** of puzzles to train with. They then enroll in a **Schedule** that defines the run structure and timing. Training sessions consist of **Runs** through the full subset, repeated according to the schedule.

---

## Architecture

```
frontend/   React 18 + TypeScript SPA (Vite, TanStack Router, Radix UI, Tailwind)
backend/    Flask REST API (Python 3.12, SQLAlchemy 2, Alembic, PostgreSQL 16)
deploy/     Docker Compose files + Terraform for AWS EC2
```

The frontend calls the backend via a JSON REST API. There is no GraphQL and no WebSocket layer. Authentication uses a server-side session cookie (Lichess OAuth 2 with PKCE).

---

## Backend

### Project layout

```
backend/
  app/
    __init__.py       create_app() factory
    extensions.py     db, cors, migrate singletons
    decorators.py     @login_required
    models/           SQLAlchemy ORM models (one file per model)
    routes/           Flask Blueprints (one file per resource)
    services/         Business logic (one file per resource)
    commands/         Flask CLI commands (puzzle import, openings import)
  migrations/         Alembic migration scripts
  tests/              pytest suite
  requirements.txt    All Python dependencies (prod + dev)
  pytest.ini
```

### Layering rules

- **Routes** do only HTTP concerns: parse request, call a service, return JSON.
- **Services** contain all business logic. They raise typed exceptions that routes map to HTTP status codes:
  - `LookupError` → 404
  - `PermissionError` → 403
  - `ValueError` → 400 (409 for specific conflict conditions)
- **Models** are pure SQLAlchemy ORM. No business logic in models.
- Never put database queries in route handlers. Always go through the service layer.

### Domain model

| Model | Table | Description |
|---|---|---|
| `User` | `users` | Authenticated via Lichess. Stores `lichess_username`, avatar, board/piece themes. |
| `Puzzle` | `puzzles` | Imported from Lichess CSV. Has `puzzle_id` (Lichess ID), `fen`, `moves` (space-separated UCI), `rating`. |
| `Theme` / `Opening` | `themes` / `openings` | Tags on puzzles (many-to-many via `puzzle_themes`, `puzzle_openings`). |
| `Subset` | `subsets` | A user-curated ordered list of puzzles. Must be **locked** before use. |
| `SubsetPuzzle` | `subset_puzzles` | Ordered join between a subset and its puzzles (`position` column). |
| `Schedule` | `schedules` | Defines the training plan: a `config` JSONB with run structure and puzzle order. Must be locked before enrollment. |
| `Training` | `trainings` | A user's enrollment in a schedule. One per user per schedule. Status: `draft` → `in_progress` → `completed` / `aborted`. |
| `Run` | `runs` | One pass through all puzzles in the subset. Belongs to a training, has a `run_index`. |
| `RunPuzzle` | `run_puzzles` | An ordered puzzle slot within a run. |
| `PuzzleAttempt` | `puzzle_attempts` | A single try at a RunPuzzle. Has `status` (`in_progress` / `correct` / `wrong`), `moves` (JSON array of UCI strings), and `time_spent_ms`. |

### Schedule config shape

`Schedule.config` is a JSONB column. The validated structure is:

```json
{
  "runs": [
    { "target_hours": 672, "break_after_hours": 168 },
    { "target_hours": 336, "break_after_hours": 72 }
  ],
  "puzzle_order": "random",
  "failed_repetition": { "mode": "none" }
}
```

- `puzzle_order`: `"random"` | `"fixed"` | `"rating_asc"` | `"rating_desc"`
- `failed_repetition.mode`: `"none"` | `"queue"` (with `"max_repeats": 1–5` when mode is `"queue"`)
- Max 20 runs. `target_hours` ≥ 1, `break_after_hours` ≥ 0.

Validation lives in `app/services/schedule.py::_validate_config`.

### JSON key conventions

- **Python (snake_case)**: model attributes, local variables, service function args.
- **JSON responses (camelCase)**: all keys in API responses use camelCase (e.g., `scheduleId`, `puzzleOrder`, `startedAt`).

### Authentication

Session cookie (`SESSION_COOKIE_HTTPONLY=True`, `SESSION_COOKIE_SAMESITE=Lax`). The `@login_required` decorator reads `session["user_id"]`. The Lichess PKCE flow lives in `app/services/auth_service.py`.

### Running and testing

```bash
# Local dev (Docker Compose)
make up              # start postgres + backend + frontend
make migrate-upgrade # run all migrations
make shell-backend   # bash shell inside the backend container

# Without Docker (needs a running postgres with woodpecker_test db)
cd backend
python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/ruff check app/ migrations/
.venv/bin/mypy app/ migrations/
.venv/bin/pytest -v                        # unit tests only
.venv/bin/pytest -m integration -v        # integration tests (needs DB)
```

Test markers: `integration` tests require a live PostgreSQL `woodpecker_test` database.

### Migrations

Always use Alembic via Flask-Migrate:

```bash
make migrate msg="describe the change"   # auto-generate migration
make migrate-upgrade                      # apply to local DB
```

Never modify existing migration files. If a migration needs to be corrected, create a new one.

---

## Frontend

### Project layout

```
frontend/src/
  main.tsx          Entry point, wraps app in AuthProvider + RouterProvider
  router.tsx        All TanStack Router route definitions
  context/          React contexts (auth)
  pages/            One component per route (full-page views)
  components/       Shared/reusable components
    ui/             Shadcn-style primitive wrappers (Button, Card, etc.)
  features/         Feature-scoped sub-components (used by pages)
  hooks/            Custom React hooks
  lib/              Utilities (cn helper, api fetch wrappers, etc.)
  assets/           Static assets
```

### Key conventions

- **Routing**: TanStack Router (`@tanstack/react-router`). Define routes in `router.tsx`. Use `beforeLoad` guards for auth redirects.
- **UI components**: Radix UI primitives (`@radix-ui/*`) wrapped in `components/ui/`. Never use raw HTML elements where a Radix primitive exists.
- **Styling**: Tailwind CSS only. No inline styles. Use `cn()` from `lib/utils` for conditional classes.
- **API calls**: plain `fetch` with credentials. No external HTTP client library.
- **Types**: All TypeScript. No `any`. Use `unknown` + narrowing where needed.
- **Testing**: Vitest + `@testing-library/react`. Test files live in `src/test/` or `__tests__/` next to components.

### Running and testing

```bash
cd frontend
npm ci
npm run typecheck   # tsc --noEmit
npm run test:run    # vitest run (single pass)
npm test            # vitest watch
npm run dev         # Vite dev server on :5173
```

---

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on pull requests to `main`:

| Job | Tool | Directory |
|---|---|---|
| Backend lint | ruff + mypy | `backend/` |
| Backend tests | pytest | `backend/` |
| Frontend lint | tsc | `frontend/` |
| Frontend tests | vitest | `frontend/` |
| Build backend | docker build | `backend/` |
| Build frontend | docker build | `frontend/` |

All jobs must pass before merging.

---

## Environment variables

See `.env.example` for the full list. Key variables:

| Variable | Description |
|---|---|
| `SECRET_KEY` | Flask session secret |
| `DATABASE_URL` | PostgreSQL connection string |
| `LICHESS_CLIENT_ID` | Lichess OAuth app client ID |
| `LICHESS_REDIRECT_URI` | OAuth callback URL |
| `APP_ORIGIN` | Frontend origin for CORS and cookie config |

---

## What agents should NOT do

- Do not put DB queries directly in route handlers.
- Do not edit `migrations/versions/` files that already exist.
- Do not add new Python dependencies without updating `requirements.txt`.
- Do not add new npm dependencies without running `npm install` and committing the updated `package-lock.json`.
- Do not bypass the `@login_required` decorator on protected endpoints.
- Do not change JSON response key names without also updating the corresponding frontend API calls.
- Do not commit `.env`, secrets, or any personal paths.
