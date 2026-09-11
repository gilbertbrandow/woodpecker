# TrainingAttempt.moves changed from list[str] to list[list[str]]

`TrainingAttempt.moves` (a JSONB column) stores all move sequences the user played on a single attempt. The schema changed from a flat `list[str]` (one sequence) to `list[list[str]]` (one inner array per Variation), where each inner array contains only the player's UCI moves for that Variation.

The immediate trigger was issue #325: users and spectators wanted to see every wrong move tried on a puzzle, not just the first failure. Under the old schema, only the first Variation (the one that caused `status = failed`) was recorded; subsequent retries in failed mode were discarded.

## Alternatives rejected

**Append-across-rows (new TrainingAttempt row per Variation)**: would require the attempt count and qualifying-attempt logic to treat intra-puzzle retries differently from inter-attempt tries configured in the schedule, and would scatter a single logical attempt across multiple rows. The single-row model better reflects the domain: one `TrainingAttempt` row = one turn the user has at a puzzle.

**Aggregate-across-rows (compute PGN from multiple rows at read time)**: same cardinality problem; also makes queries more complex for no gain over the nested-array approach.

**Deferred conclude (hold status=in_progress until user gives up)**: would mean a user who closes the tab mid-retry does not get a failure recorded, breaking the invariant that the attempt is durably persisted after the first wrong move. Conclude-immediately + append-variation preserves that invariant.

## Trade-offs accepted

- **Hard to reverse**: existing rows required a one-time migration (wrap every non-empty flat array into a single-element outer array). The migration is a SQL one-liner and was confirmed safe against prod data (all 13,019 non-empty rows were flat string arrays, zero nulls).
- **Append is fire-and-forget**: subsequent Variations are sent to the backend after each wrong move in failed mode. If the tab is closed mid-retry, only the extra Variations are lost; the first Variation (and the `status = failed` outcome) are already committed.
- **PGN is now item-level, not attempt-level**: `pgnDisplay` is computed from the selected attempt's `moves` (all Variations) and returned as a single aggregate object on `RunTrainingItemOverview` rather than as a per-attempt field. The mainline is always the correct solution; each failed Variation contributes one `??` subvariation at the divergence point.
