# Attempt conclusion and variation append fire immediately on wrong move

When a user plays a wrong move in Focus Mode, `conclude()` (POST .../complete) fires immediately — before the 500 ms visual revert delay. When a user plays a wrong move in Failed Mode, `appendVariation` (POST .../variations) also fires immediately. In both cases the board revert is a purely cosmetic animation that runs concurrently with the in-flight API call.

## Alternatives rejected

**Fire after the delay**: waiting 500 ms before persisting means a tab-close during the animation loses the move entirely. The attempt outcome is deterministic the moment the wrong move is detected; there is no reason to defer writing it.

**Block the revert on the API response**: making the user wait for a network round-trip before the board snaps back would add noticeable latency to what should feel instant. The board state is local; persistence can race the animation.

## Trade-offs accepted

- The API call may complete before or during the 500 ms delay. The UI must handle the case where `overview.data` arrives while the wrong move is still showing on the board.
- For `appendVariation` in Failed Mode, the subsequent overview re-fetch (to refresh the Aggregate PGN with the new subvariation) is chained after `appendVariation` resolves, not fired independently. This ensures the variation is committed before the PGN is re-read.
