# CLAUDE.md — Project conventions for LLMs

These rules apply to every file in this repository, regardless of the feature or spec being implemented. Follow them strictly and do not deviate without explicit instruction.

---

## TypeScript (frontend)

- All frontend code is **TypeScript**. No `.js` or `.jsx` files in `frontend/src/`. Use `.ts` and `.tsx`.
- `tsconfig.json` must have `"strict": true`. Never disable strict mode or individual strict checks.
- No `any`. If a type is genuinely unknown, use `unknown` and narrow it explicitly.
- All function parameters and return types must be explicitly annotated unless the return type is trivially inferred from a literal (e.g. a simple arrow function returning JSX is fine without annotation, but prefer explicit when ambiguous).
- Prefer `type` over `interface` for object shapes unless declaration merging is needed.
- No non-null assertions (`!`) unless genuinely unavoidable.

## Python (backend)

- All functions and methods must have **type hints** on every parameter and the return type. No exceptions.
- No use of `Any` from `typing` unless genuinely unavoidable.
- Follow PEP 8. Use `ruff` for linting and formatting.
- Prefer `dataclasses` or `TypedDict` over plain dicts for structured data.
- Use `|` union syntax (Python 3.10+), not `Union[]` or `Optional[]`.

## Backend Structure

The backend follows a strict layered structure. Every feature maps to the same layout.

```text
backend/
├── app/
│   ├── __init__.py        # create_app() factory only
│   ├── extensions.py      # Flask extension instances (db, cors) — no logic
│   ├── models/            # SQLAlchemy model classes — no business logic
│   ├── routes/            # Flask Blueprints — one file per domain
│   └── services/          # Business logic — one file per domain
└── app.py                 # Entrypoint: imports and calls create_app()
```

**Models** (`app/models/`) — SQLAlchemy model classes only. No methods containing business logic. No imports from `routes` or `services`.

**Routes** (`app/routes/`) — Flask Blueprints. One blueprint per domain (e.g. `auth.py`, `puzzles.py`). Handlers must be thin: parse the request, call a service function, return a response. No business logic inline.

**Services** (`app/services/`) — All business logic lives here. Service functions are plain Python functions. They must not import from `flask` (no `request`, `session`, `g`). Data flows in via arguments, out via return values.

**Extensions** (`app/extensions.py`) — Instantiate Flask extensions here (`db = SQLAlchemy()`, `cors = CORS()`). Import from here everywhere else to avoid circular imports. Extensions are initialized against the app inside `create_app()`.

**Rules:**

- Routes call services. Services call models. Models know nothing above them.
- No business logic in route handlers. No Flask context in service functions.
- Blueprints are registered in `create_app()`, not imported at module level.

---

## Frontend Architecture

### Routing — TanStack Router

- TanStack Router is the sole routing solution. No React Router.
- Routes are defined in `frontend/src/router.tsx` using code-based routing.
- Route params and search params are fully typed — never cast or use `as`.
- Protected routes guard via `useEffect` redirect when `auth.loading` is false and `auth.user` is null.

### API Client

- All backend communication goes through `frontend/src/lib/api.ts`. No `fetch` calls outside this file.
- `api.ts` exposes typed async functions per endpoint. All paths are relative (`/api/...`) — the Vite dev proxy and nginx in production both route these to the backend. `api.ts` handles JSON serialisation and maps HTTP error responses to thrown `ApiError` instances.
- As error handling evolves, `api.ts` is the single place to add retry logic, auth error interception, or response normalisation.

### Notifications — Sonner

- Sonner is the sole notification system. No `alert()`, no custom toast state.
- Import `toast` from `sonner` wherever a user-facing notification is needed.
- `<Toaster />` is mounted once at the app root.
- Always use the title + description structure: `toast('Title', { description: 'Supporting detail.' })`. A single-line toast is never enough.
- `richColors` is intentionally not set — all toasts render in neutral colors. Semantic meaning comes from the message, not the color. Reserve `toast.error` for failures the user must act on.
- Toaster is positioned `bottom-center`.

---

## Visual Design

- **Neutral palette only.** No accent colours. Use shadcn/ui's default neutral (zinc/slate) scale exclusively. Raw palette values are forbidden (see Dark/Light Mode rules).
- The chessboard is rendered by an external package (react-chessground) with its own visual language. The surrounding UI must not compete with it — whitespace and neutrals are the design.
- **Plain by default.** No decorative elements, gradients, shadows, or rounded corners beyond what shadcn/ui applies by default.
- Typography does the visual work. Hierarchy is expressed through size and weight, not colour.
- The `monospace` font applies globally and is configured as the default in `tailwind.config`.

---

## Dark / Light Mode

- The app supports dark and light mode via a `ThemeProvider` context that toggles a `dark` class on `<html>`.
- shadcn/ui's CSS variables handle all colour switching automatically — never hardcode colours outside of CSS variables.
- Default to the user's OS preference (`prefers-color-scheme`) on first visit. Persist the user's explicit choice in `localStorage`.
- All Tailwind colour utilities must use semantic tokens (`bg-background`, `text-foreground`, `border-border`, etc.) — never use raw palette values like `bg-white` or `text-gray-900` which break in dark mode. **Exception:** warning and error callout components (e.g. amber banners, destructive notices) may use raw palette values (e.g. `border-amber-600/30`, `text-amber-800`) with appropriate dark-mode variants, since these carry intentional semantic colour meaning beyond what the neutral token scale expresses.
- The `ThemeProvider` and its `useTheme` hook live in `frontend/src/context/theme.tsx` and are the single source of truth for the current theme.

---

## Responsive Design

- **Mobile-first.** All UI is designed and built for small screens first, then scaled up for larger viewports. Use Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`) to add complexity upward, never downward.
- Touch targets must be large enough to tap comfortably (minimum `44px` height for interactive elements).
- No horizontal scrolling on any viewport.
- Test layouts at 375px width (iPhone SE) as the baseline.

---

## General

- **No comments.** Code must be self-documenting through clear naming and structure. Do not write inline comments, block comments, or docstrings unless explicitly asked. If a comment feels necessary, the code should be refactored instead.
- No dead code. Do not leave commented-out code, unused imports, or placeholder `pass` blocks.
- No magic numbers or strings — use named constants.
- Keep functions small and single-purpose.
- Never silence exceptions with bare `except: pass` or `except Exception: pass`.
