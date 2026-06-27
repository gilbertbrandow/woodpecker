---
name: commit
description: Critically review unstaged/staged changes for correctness, performance, and design quality, then run lint + mypy via `make lint`, and only commit if the code meets a high bar — aborting with required fixes otherwise. Use when asked to "review and commit", "make sensible commits", "commit my changes", or "commit with (#NNN)".
---

# Commit

High-bar review first, then commit. Abort if anything is wrong.

## Flow

1. **Orient** — `git status` + `git diff` + `git diff --cached` to see the full picture
2. **Code review** — read every changed file carefully and judge against the bar below; list all findings
3. **Gate** — if any blocking findings exist, **stop**: present them clearly and ask the user to fix before proceeding
4. **Quality checks** — run `make lint` (ruff + mypy for backend, linter for frontend); fix or escalate any errors
5. **Test coverage** — check whether new logic is tested; missing tests for non-trivial code are a blocking finding
6. **Commit** — only if the code passes; group by area, follow the commit style below; no co-authors

## Review bar

Be critical. The goal is to only commit code you'd be proud to ship. Flag anything that falls short.

**Blocking (abort until fixed):**
- Correctness bugs: wrong logic, off-by-one, unhandled edge cases, incorrect data flow
- Type errors or unsafe casts that mypy would catch
- Missing tests for new non-trivial functions, endpoints, or business logic
- Obvious performance problems: N+1 queries, unnecessary re-renders, O(n²) where O(n) is straightforward
- Security issues: injection risks, exposed secrets, missing auth checks
- Dead code or unfinished stubs committed accidentally

**Non-blocking (note, don't abort):**
- Style preferences that don't affect correctness
- Minor naming quibbles
- Pre-existing issues outside the diff
- Speculative performance concerns without evidence

Present blocking findings as a numbered list with file:line references and a concrete fix for each.

## Commit style

Pattern: `{Area}: {description} (#{issue})`

- Extract the issue number from the branch name (e.g. `42-include-decoys` → `#42`; if none, ask)
- Areas: `Backend`, `Frontend`, `Pipeline`, `Infra`
- Use `—` (em dash) to separate sub-topics within one area
- Keep the description imperative and concrete

Examples:
```
Backend: expose analysis depth in DecoyMetadata API (#42)
Frontend: decoy overview revamp — game info, subvariations, scarecrow icon (#42)
Pipeline: GM title fallback and accepted_moves fix (#42)
```

## Commit rules

- No `Co-Authored-By` lines — ever
- One commit per logical area/concern; split further if two unrelated things changed in the same area
- Never `git add -A`; stage specific files
- Never `--no-verify`
