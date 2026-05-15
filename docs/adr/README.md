# Architecture Decision Records

ADRs live here as `NNNN-short-title.md`, numbered sequentially from `0001`.

## Format

Each ADR is a short document — often just a paragraph:

```md
# Short title of the decision

1-3 sentences: what's the context, what did we decide, and why.
```

Only add optional sections (`Status`, `Considered Options`, `Consequences`) when they genuinely add value.

## When to write an ADR

All three must be true:

1. **Hard to reverse** — changing your mind later would be costly
2. **Surprising without context** — a future reader would wonder "why did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and one was chosen for specific reasons

See `.claude/skills/engineering/grill-with-docs/ADR-FORMAT.md` for the full guidance.
