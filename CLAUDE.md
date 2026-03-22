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

## General

- **No comments.** Code must be self-documenting through clear naming and structure. Do not write inline comments, block comments, or docstrings unless explicitly asked. If a comment feels necessary, the code should be refactored instead.
- No dead code. Do not leave commented-out code, unused imports, or placeholder `pass` blocks.
- No magic numbers or strings — use named constants.
- Keep functions small and single-purpose.
- Never silence exceptions with bare `except: pass` or `except Exception: pass`.
