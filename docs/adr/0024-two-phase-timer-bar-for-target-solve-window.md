# Two-phase timer bar for Target Solve Window

When a Run has a Target Solve Window, the board page shows a progress bar during active solving: the bar fills from 0% → 100% as elapsed time approaches the min (fill-up phase), then counts down from 100% → 0% as elapsed time approaches the max (countdown phase), and disappears once the max is exceeded.

The alternative considered was a single countdown-from-max bar with a static marker drawn at the min position. That was rejected because the fill-up phase makes the "don't rush" nudge kinetic — a rising bar viscerally communicates "stay here a moment longer" without the user needing to locate a marker. A marker on a countdown bar requires reading two elements at once and is easy to miss.

## Considered Options

- **Static min marker on existing countdown bar** — simpler, but weaker nudge signal during the pre-min phase
- **No bar change** — min only surfaces on the RunPage configuration slider and post-solve badge; rejected as too passive during solving
