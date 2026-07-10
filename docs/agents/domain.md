# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — the project's domain glossary and ubiquitous language.
- **`docs/adr/`** — architectural decision records. Read ADRs that touch the area you're about to work in before proposing changes.

If either file doesn't exist, proceed silently. Don't flag their absence; don't suggest creating them upfront. The `/grill-with-docs` skill creates them lazily as decisions are resolved.

## Layout

This is a **single-context repo**:

```text
/
├── CONTEXT.md          ← domain glossary
├── docs/adr/           ← architectural decisions
├── backend/
├── frontend/
└── pipeline/
```

There is no `CONTEXT-MAP.md`. One `CONTEXT.md` covers the entire codebase.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Do not drift to synonyms the glossary marks as avoided.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0001 (pipeline owns ingestion) — but worth reopening because…_
