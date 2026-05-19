# ADR 0009 — Multi-source Subset config schema

**Status**: Accepted  
**Date**: 2026-05-19  
**Issue**: #117

## Context

The `subsets.config` JSONB column originally stored a flat, Lichess-Tactic-centric config:

```json
{
  "rating": { "min": 1800, "max": 2600, "mean": 2200, "sigma": 100 },
  "themes": { "fork": 2 },
  "openings": { "items": ["A00"], "strength": 0.7 }
}
```

Supporting multiple Sources (LICHESS_TACTIC, SCRAPED_POSITIONAL, future DECOY) requires per-source filter configs and a percentage allocation per Source.

## Decision

Replace the flat config with a `sources` array representing the SourceComposition:

```json
{
  "sources": [
    {
      "source": "LICHESS_TACTIC",
      "percentage": 60,
      "config": {
        "rating": { "min": 1800, "max": 2600, "mean": 2200, "sigma": 100 },
        "themes": { "fork": 2 },
        "openings": { "items": ["A00"], "strength": 0.7 }
      }
    },
    {
      "source": "SCRAPED_POSITIONAL",
      "percentage": 40,
      "config": {
        "difficulty": [1, 2, 3, 4],
        "themes": ["space", "kingsafety"],
        "opening": { "items": ["D30"], "strength": 0.5 }
      }
    }
  ]
}
```

Percentages always sum to 100. Existing rows are migrated via an Alembic data migration: each flat config is wrapped as a single LICHESS_TACTIC entry at 100%.

## Alternatives considered

**Keep flat config, add source-keyed top-level keys** (e.g. `lichess_tactic_config`, `scraped_positional_config`): rejected — does not scale to N sources, makes the percentage allocation awkward, and leaves the schema ambiguous for single-source subsets.

**Separate config table** (one row per source per subset): rejected — adds a join for every config read with no meaningful benefit over JSONB for this schema.

## Consequences

- `_parse_config` and `_sample_puzzles` in `subset.py` are replaced by per-source samplers dispatched from a new `_sample_all_sources` function.
- `PATCH /subsets/{id}/config` accepts the new shape; the backend validates that percentages sum to 100.
- `GET /subsets/{id}/stats` returns a per-source map keyed by source type.
- `DELETE /subsets/{id}/puzzles/{lichess_puzzle_id}` becomes `DELETE /subsets/{id}/puzzles/{training_item_id}` (source-agnostic).
- Locked subsets have their config migrated but never re-sampled; no functional impact.
