# TrainingItemPayload carries shared computed fields; frontend never branches on source type for display data

Five fields that were previously scattered across per-source metadata, stored columns, or computed in the frontend are unified onto `TrainingItemPayload`, computed at serve time by each `TrainingItemContent` implementation.

## Context

Before this decision the code had a pervasive isinstance smell: every component that consumed training item data — `run.py`, `subset.py`, `PuzzleTable.tsx`, `RunTrainingItemTable.tsx`, `TrainingItemMetaCard.tsx` — independently branched on `sourceType` to extract or format display data. The same derivations were duplicated across both sides of the API:

**Stored redundantly in the DB (dropped in this issue):**

- `lichess_tactics.game_url` — derivable from `SourceGame.lichess_id + FEN ply`
- `scraped_positional_puzzles.lichess_url` — same derivation
- `decoy_puzzles.analysis_url` — stored at import but silently ignored by the serving path, which recomputed it anyway
- `decoy_puzzles.opponent_move` — derivable from `SourceGame.moves.split()[move_number − 2]` (0-based). `move_number` is the 1-indexed ply of the **player's response**; the opponent's move is at ply `move_number − 1` (SQL 1-indexed) = Python index `move_number − 2`.

**Computed in the frontend from source-specific fields:**

- Rating display: `"1500"` for tactics, `"1800–2000"` or `label` for positionals, `"—"` for decoys — the `minRating–maxRating` formula appeared in four separate components
- Analysis URL: three-way dispatch on `gameUrl` / `lichessUrl` / `analysisUrl` in every table and card
- Lichess training URL for tactics: `https://lichess.org/training/${displayId}` assembled in `RunTrainingItemTable`
- Opening: `openings[1] ?? openings[0]` for tactics vs `opening` for other types — inconsistent field shape across listing endpoints
- Game header: only present in `DecoySourceMetadata`; not available for other types despite all now having a `SourceGame`

## Decision

`TrainingItemPayload` gains five shared fields, all computed by the `TrainingItemContent` ABC implementation for each source type:

| Field | Type | Computed as |
| --- | --- | --- |
| `analysis_url` | `str` (non-null) | Lichess game URL `{lichess_id}{color}#{ply}` when game has `lichess_id`; Lichess analysis board URL with puzzle FEN otherwise |
| `training_url` | `str \| None` | `https://lichess.org/training/{puzzle_id}` for `LICHESS_TACTIC`; null for all other types |
| `opening` | `dict \| None` | `{ name, displayName, eco }` — single canonical opening; null when none available |
| `game` | `dict \| None` | `{ white, black, whiteTitle, blackTitle, whiteElo, blackElo, event, date, lichessId }` from the SourceGame |
| `rating_display` | `str \| None` | `str(rating)` for tactics; `"{min}–{max}"` or `label` for positionals; null for decoys |

`SourceMetadata` remains opaque and carries only source-specific data (themes, accepted moves, difficulty tiers, etc.). The frontend dispatches on `sourceType` only in the overview metadata card — the one place where source-specific display is intentional.

Per-source field name aliases (`gameUrl`, `lichessUrl`) are retired from all API responses. All listing endpoints return `opening` (singular) for every source type.

## Considered alternatives

**Keep analysis URL stored:** The Decoy case proved stored values drift from serve-time computation (importer wrote FEN-based URL; server computed game URL for rows with `lichess_id`). Rejected.

**Keep per-source field names as stable API contract:** Would require permanent frontend dispatch and prevent the frontend from becoming source-agnostic. Rejected — both sides of the API are in this repo.

**Keep `opponent_move` stored:** Derivable from `SourceGame.moves.split()[move_number − 2]` (see formula note above). A pre-drop verification script (`backend/scripts/verify_analysis_urls.py`) compares the derivation against stored values on a representative production sample before the column is dropped; run it before applying the migration.

## Consequences

- All `game_id` FK columns are already `NOT NULL` (enforced by migration `v5w6x7y8z9a0`) — no precondition assertions needed in the new migration.
- Batch serving paths must eager-load `game` for all three source types.
- `decoy_puzzles.analysis_url` column and `DecoyPuzzle.analysis_url` model field are dropped; the Decoy importer stops writing them.
- `DecoySourceMetadata` loses `analysis_url`, `game`, and `opening`; `LichessTacticSourceMetadata` loses `gameUrl` and `opening`; `ScrapedPositionalSourceMetadata` loses `lichessUrl` and `opening`.
- `DecoyMetadata` gains `themes: []` (empty list) so `source.themes` is safely accessible without a source-type guard on every caller.
- `LichessTacticRow` in listing responses changes from `openings: []` (array) to `opening` (singular) — the backend picks the canonical opening (`openings[-1]` if available).
