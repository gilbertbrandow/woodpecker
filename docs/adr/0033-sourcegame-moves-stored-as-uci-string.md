# SourceGame moves stored as a full UCI string on the SourceGame model

The full game move sequence for a SourceGame is stored as a single space-separated UCI string in `SourceGame.moves` (column `games.moves`), deduped at the SourceGame level rather than per-puzzle. The Lichess NDJSON export API returns moves in SAN notation; conversion to UCI happens at write time using python-chess, paying the cost once per game rather than on every serve request.

## Considered options

**SAN (store as-is from the API):** Avoids the write-time conversion, but requires a full python-chess replay on every request to derive UCI for the frontend. Creates asymmetry with `LichessTactic.moves`, which is already UCI.

**PGN text (with headers):** Self-contained and parseable by standard tools, but ~2× larger than UCI, requires a PGN parser at read time, and adds no information the SourceGame model doesn't already store in structured columns (white, black, event, etc.).

**Per-puzzle storage (on each puzzle table):** Avoids a join at serve time, but duplicates move data across every TrainingItem that shares a game — meaningful at the scale of the Lichess tactics source. Inconsistent with the normalization the SourceGame entity already provides.

## Consequences

- `SourceGame.moves` is stored raw from the API after SAN→UCI conversion; Chess960 castling normalisation (`e1h1` → `e1g1` etc.) is applied at serve time by the existing `_split_moves` utility, consistent with how `LichessTactic.moves` is handled.
- The SourceGame Prelude (the moves shown before the puzzle position) is derived at serve time by slicing `SourceGame.moves` at the ply encoded in the puzzle's enriched FEN — no additional column is needed on puzzle tables.
- Changing the stored format later requires replaying all SourceGame records through python-chess.
