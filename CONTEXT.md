# Woodpecker

A chess training app that operationalises the Woodpecker Method: repeatedly solving the same fixed set of puzzles in progressively shorter cycles to build tactical pattern recognition.

## Language

**TrainingItem**:
A generic, source-agnostic record for one solvable puzzle. Carries only identity and a `source_type` tag; all puzzle content (board position, solution, metadata) lives in a source-specific companion record. The solving flow operates on TrainingItems regardless of where they came from.
_Avoid_: puzzle (overloaded with UI usage), item

**Source**:
A named external puzzle data provider. Each Source has its own Pipeline importer, a source-specific metadata table, and its own solving semantics — what counts as "correct" is defined per Source, not by the generic solving engine. Current sources: `LICHESS_TACTIC`, `SCRAPED_POSITIONAL`, `DECOY`.
_Avoid_: dataset, data source

**Lichess Tactic**:
A TrainingItem sourced from the Lichess tactics database. Solved by playing a full exact UCI move sequence. Overview shows the Lichess puzzle ID, themes, and opening.

**Scraped Positional**:
A TrainingItem from the `SCRAPED_POSITIONAL` source (dataset from github.com/neilgd/chess-position-analysis-results). Solved by playing a single exact correct move. The stored FEN is the position _before_ the opponent's last move (identical convention to Lichess Tactic); the opponent move is prepended at import time via Lichess API enrichment. Overview shows the internal puzzle ID linked to the Lichess game position, a PositionalDifficulty badge, and PositionalTheme badges.

**PositionalDifficulty**:
A seeded lookup record describing a difficulty tier for `SCRAPED_POSITIONAL` puzzles. Carries a numeric value (1–4), a label (e.g. "Hard"), a description, and a nullable ELO rating range (`min_rating`, `max_rating`). Displayed as a badge showing both the label and the rating range. Seeded by `positional difficulties import` before puzzle import.
_Avoid_: rating, level

**PositionalTheme**:
A categorical tag applied to a `SCRAPED_POSITIONAL` puzzle (e.g. `space`, `kingsafety`, `prophylaxis`). Seeded by `positional themes import` before puzzle import. Each theme carries a `name` (raw CSV column key), `display_name`, and `description`. A puzzle may have multiple PositionalThemes, stored via a pivot table.
_Avoid_: tag, category

**Decoy**:
A TrainingItem from the `DECOY` source. Sourced from classical OTB master games: a position (from move 20 onwards) where the engine confirms at least three moves are within 50 centipawns of the best evaluation. Solved by playing any one of those accepted moves — the only source type with a set-match (non-exact) validation rule. The stored FEN is the position before the opponent's last move, consistent with the SolveContract invariant. Each Decoy is linked to an Opening (via ECO code from the source game's PGN headers) for display and filtering. Configurable in a SourceComposition by opening (ECO hierarchy).
_Avoid_: dud tactic, decision position (pipeline-internal term only)

**Subset**:
A user-curated collection of TrainingItems, forming the fixed puzzle set for one training cycle. A Subset can draw from one or more Sources.
_Avoid_: set, puzzle set, collection

**Schedule**:
A pre-configured training plan linking a Subset to a time-based recurrence and a specific user. The configuration determines how many Runs to perform and the target accuracy and speed for each.
_Avoid_: plan, recurring session

**Training**:
A user's active engagement with one Schedule. At most one non-terminal Training (i.e. not `aborted` and not `completed`) exists per user per Schedule; multiple historical Trainings are permitted. Tracks when the user started, completed, or aborted their work through the Schedule's Runs.
_Avoid_: session, training session

**Run**:
One complete cycle through all TrainingItems in the Schedule's Subset. Belongs to a Training and is indexed within it by `run_index`. Each Run carries its own target accuracy and time limits.
_Avoid_: session, cycle

**Break**:
The suggested rest period between two consecutive Runs in a Training. Duration is defined by `break_after_hours` on the preceding RunDefinition in the Schedule config. A Break is a planning aid — the system surfaces whether the user is within or past the expected Break window, but never blocks a new Run from starting early or late.
_Avoid_: mandatory break, enforced break, cooldown

**Training State**:
A derived, never-stored summary of where a user currently stands in their Training. Computed at query time from Run timestamps, the Schedule config, and the current wall-clock time. Possible values: `not_started`, `in_progress`, `on_break`, `break_elapsed`, `completed`, `aborted`. Carried as enriched fields on the Training list response — no separate endpoint.
_Avoid_: training status (ambiguous with Run status), training phase

**TrainingAttempt**:
A recorded solve attempt on a single TrainingItem within a Run. Captures whether the user solved it correctly and how long it took. A user may make multiple attempts on the same item in one Run.
_Avoid_: solve, attempt, move

**Pipeline**:
The standalone Python + Click CLI that imports data from external sources into the shared database. Runs independently of the Flask backend but shares SQLAlchemy models.
_Avoid_: importer, ingestion script, scraper

**SourceImportRun**:
A database record (`source_import_runs`) tracking one execution of a Pipeline import command. Only `lichess-tactics tactics import` creates one; openings and themes imports leave no run trace.
_Avoid_: import run, pipeline run, pipeline execution

**Theme**:
A categorical tag applied to Lichess tactics (e.g. `fork`, `pin`, `skewer`). Seeded by the `lichess-tactics themes import` Pipeline command, which must run before tactic import.
_Avoid_: tag, category, topic

**ECO code**:
A standardized encyclopedia code identifying a chess opening by its initial move sequence (e.g. `A00`, `D30`). Used by the `openings` Pipeline source.
_Avoid_: opening code

**SourceComposition**:
The breakdown of a Subset by Source, expressed as integer percentages that always sum to 100. Stored as part of the Subset config. Each entry carries a Source identifier, a percentage, and a per-source filter config. Determines how many TrainingItems are drawn from each Source during sampling. A Subset with a single Source has a SourceComposition of 100% for that Source. Percentages are hard caps — if a Source's eligible pool is smaller than its allocation, that Source fills what it can and the shortfall is reported to the user rather than redistributed.
_Avoid_: source split, source ratio, source weights

**Mixed-source Subset**:
A Subset whose SourceComposition references more than one Source (e.g. 60% Lichess Tactics, 40% Scraped Positional). Within a single Run a user may encounter any source type. The solving loop, overview stats, and attempt history are source-agnostic; only the TrainingItem metadata display varies.

**SolveContract**:
The source-agnostic interface between the content dispatcher and the solving engine. Contains the starting FEN and an interleaved sequence of plies (opponent and player moves alternating). Opponent plies are always exact UCI strings; player plies are either a single exact UCI move or a set of accepted UCI moves (set-match). The engine operates exclusively on SolveContracts and never branches on source type.
_Avoid_: solution contract, move sequence, puzzle contract

**SourceMetadata**:
An opaque, source-typed structure carrying display data for one TrainingItem. Tagged with `sourceType` as a discriminant. The backend passes it through to the API response without inspecting its contents. The frontend dispatches on `sourceType` in exactly one place — the overview metadata card — and is otherwise fully source-agnostic. Each Source defines its own SourceMetadata shape; rating is source-specific and lives here, not at the top level.
_Avoid_: source data, puzzle metadata, display metadata

## Relationships

- A **Source** contains many **TrainingItems**
- A **Subset** selects **TrainingItems** from one or more **Sources**
- A **Schedule** links one user to one **Subset** with a training configuration
- A **Training** belongs to one **Schedule** (one Training per user per Schedule)
- A **Training** contains many **Runs**, each indexed sequentially
- A **Run** produces one **TrainingAttempt** per **TrainingItem** in the Subset
- A **Pipeline** import creates a **SourceImportRun** and populates **TrainingItems**
- A **TrainingItem** from `lichess-tactics` may carry one or more **Themes**

## Example dialogue

> **Dev:** "When a user imports a new Lichess puzzle set, do we create a Subset automatically?"
> **Domain expert:** "No — the Pipeline creates TrainingItems and a SourceImportRun. The user then builds a Subset manually by selecting from those TrainingItems."
> **Dev:** "Can a Run span multiple Subsets?"
> **Domain expert:** "No. A Run belongs to a Training, which belongs to a Schedule, which is tied to exactly one Subset. To train across multiple puzzle sets, the user composes a Subset from multiple Sources."

**Display Name**:
The sole public identity of an active user. Required (non-null) for all active users. Chosen during onboarding, prefilled with the user's Lichess username. Validated on all writes: 2–32 characters, letters/numbers/spaces/underscores/hyphens only. Lichess username is never shown publicly; Display Name is used everywhere another user is represented.
_Avoid_: nickname (prior code term, renamed), username (when referring to public display)

**User Cap**:
The configured maximum number of active users, controlled by the `MAX_USERS` environment variable. Defaults to 0 (fully closed). Existing users are never blocked by the cap. Whitelisted users bypass it.
_Avoid_: limit, max users, participant cap

**Whitelist**:
A set of Lichess usernames (stored lowercase) that are permitted to sign up regardless of the User Cap. Managed by operators via a deploy command (`make -C deploy whitelist-add`), not through an admin UI.
_Avoid_: allowed list, bypass list

**Waitlist**:
A separate table of Lichess users who authenticated but could not create an account because the User Cap was reached and they are not Whitelisted. Not part of the main users table. Waitlisted users may optionally provide an email address for future outreach. Insertion is idempotent by Lichess username.
_Avoid_: pending users, blocked users, queue

## Flagged ambiguities

- "puzzle" appears in the UI, old docs, and issue history — resolved: use **TrainingItem** for the stored record; "puzzle" is acceptable only in user-facing UI copy.
- "cycle" is used loosely in the Woodpecker Method description — resolved: use **Run** for the software concept.
- "nickname" was the prior code-level field name for user display identity — resolved: renamed to `display_name` everywhere (DB column, model, API, frontend) as part of issue #10.
