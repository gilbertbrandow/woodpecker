# Copilot Instructions for Woodpecker

## Architecture rules

- **Routes only do HTTP**. Parse the request, call a service function, return JSON. No business logic or DB queries in route handlers.
- **Services own business logic**. All validation, DB reads/writes, and error raising happen in `backend/app/services/`.
- **Models are plain ORM**. No business logic in `backend/app/models/`.
- **Raise typed exceptions from services**. Routes map them to HTTP codes:
  - `LookupError` → 404
  - `PermissionError` → 403
  - `ValueError` → 400 (use 409 for specific conflict messages)

## Schema changes

- Always use Alembic (Flask-Migrate) for schema changes. Never modify the ORM models without a matching migration.
- Generate with `make migrate msg="..."`, apply with `make migrate-upgrade`.
- Never edit existing migration files. Create a new one to correct mistakes.

## Python conventions

- Python 3.12. Full mypy-compatible type annotations on all functions and class attributes.
- snake_case for Python identifiers, camelCase for all JSON response keys.
- Use `ruff` for linting. No unused imports, no bare `except`.
- When accessing `schedule.config` (a `dict[str, object]`), always validate types with `isinstance` before use.

## Frontend conventions

- TypeScript only. No `any`. Use `unknown` + type narrowing where needed.
- Routing via TanStack Router (`@tanstack/react-router`). All routes defined in `frontend/src/router.tsx`.
- UI primitives from Radix UI (`@radix-ui/*`), wrapped in `frontend/src/components/ui/`.
- Styling with Tailwind CSS. No inline styles. Use the `cn()` helper from `src/lib/utils` for conditional classes.
- API calls use plain `fetch` with `credentials: 'include'`. No external HTTP client.

## Testing

- Backend: pytest. New service functions need tests. Integration tests that require a live DB must be marked `@pytest.mark.integration`.
- Frontend: Vitest + `@testing-library/react`. Test files go in `src/test/` or a local `__tests__/` folder.
- Run backend tests: `cd backend && .venv/bin/pytest -m "not integration"`
- Run frontend tests: `cd frontend && npm run test:run`

## What to avoid

- No DB queries in route handlers.
- No inline styles in JSX.
- No `any` in TypeScript.
- No editing of existing Alembic migration files.
- No committing `.env`, secrets, or local paths.
