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
The breakdown of how a Subset is filled, expressed as integer percentages across Sources and SubsetRefs that always sum to 100. Stored as part of the Subset config under a `sources` key (for Source entries) and a `subsetRefs` key (for SubsetRef entries). Determines how many TrainingItems are drawn from each Source or SubsetRef during sampling. Percentages are hard caps — if an entry's eligible pool is smaller than its allocation, that entry fills what it can and the shortfall is reported to the user rather than redistributed.
_Avoid_: source split, source ratio, source weights

**SubsetRef**:
An entry in the SourceComposition that draws TrainingItems from an existing locked Subset rather than from an external Source. Carries a `subsetId`, a percentage of the total allocation, and an optional `excludeSources` list of source types to skip when sampling from the referenced Subset (opt-out; omitting the field means all source types in the referenced Subset are eligible). SubsetRefs and Sources share the same 100% allocation pool.
_Avoid_: subset reference, source subset

**ExcludedSubsets**:
A list of locked Subset IDs stored at the top level of the Subset config (`excludeSubsets: [id, ...]`). Any TrainingItem already present in any listed Subset is ineligible during sampling, regardless of which Source or SubsetRef would have produced it. Applied across all Sources and SubsetRefs during every fill and refill.
_Avoid_: exclusion list, blocked subsets

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
A set of Lichess usernames (stored lowercase) that are permitted to sign up regardless of the User Cap. Managed either via a deploy command (`make -C deploy whitelist-add`) or through the Admin Page by a Superadmin.
_Avoid_: allowed list, bypass list

**Waitlist**:
A separate table of Lichess users who authenticated but could not create an account because the User Cap was reached and they are not Whitelisted. Not part of the main users table. Waitlisted users may optionally provide an email address for future outreach. Insertion is idempotent by Lichess username.
_Avoid_: pending users, blocked users, queue

## Error envelope

**AppError**:
The base exception class for all domain errors that map to HTTP error responses. Carries `title` (required, user-facing heading) and `detail` (required, user-facing elaboration). The HTTP status code is a class-level attribute set by each subclass, not passed at the raise site. Subclasses: `ValidationError` (422), `ConflictError` (409), `NotFoundError` (404), `ForbiddenError` (403). Replaces bare Python builtins (`LookupError`, `PermissionError`) and the prior `ConflictError`/`ValidationError` which lacked `detail`.
_Avoid_: HttpException (collides with Werkzeug), DomainError

**Error envelope**:
The JSON shape returned for all error responses: `{"title": "...", "detail": "..."}`. Both fields are always present and non-null — no optional fields. `title` is a short heading; `detail` elaborates for the user. The HTTP status code is carried in the response header only, not repeated in the body. 500 responses use the same envelope with safe generic copy hardcoded in the handler. `meta` is reserved for a future extension to carry structured Sentry context.
_Avoid_: error body, error response (too generic)

## Dashboard

**Dashboard**:
The `/app` page, scoped to a selected Training and selected Run. Replaced the previous global leaderboard-centered page as of issue #8. The selected Training and Run are encoded as `trainingId` and `runIndex` query params. The backend resolves missing or invalid params to defaults and the frontend replaces the URL after resolution.
_Avoid_: home page, overview page

**Virtual Run**:
A placeholder Run slot shown in the dashboard run selector when the selected Training has zero Runs. Only Virtual Run 1 exists (runIndex 0); there is no backing Run record. Shows N/A for all metrics and a Start Run 1 CTA. Future not-yet-created slots beyond Run 1 are visible in the selector but disabled — they are not virtual runs.
_Avoid_: placeholder run, fake run, empty run

**Latest Touched**:
A computed sort key for a Training in the dashboard training selector. Equals the latest `Run.started_at` across all of the Training's Runs if any exist, otherwise falls back to `Training.started_at`. Used to order trainings so the most recently active one is selected by default.
_Avoid_: last active, most recent

**Run Slot**:
A position in the dashboard run selector, from index 0 to `schedule.runCount − 1`. A Run Slot backed by an existing Run is selectable; a Run Slot with no backing Run is visible but disabled. Virtual Run 1 (runIndex 0) is the one exception: when no Runs exist it is treated as selectable even though no Run record exists yet.
_Avoid_: run position, run entry

**Primary Action**:
A structured CTA descriptor returned inside the dashboard status card payload. One of `{ type: "continue_run", runId }`, `{ type: "start_run", trainingId, runIndex }`, or `null`. The backend owns the action type and its parameters; the frontend owns all button copy and styling.
_Avoid_: CTA, action button

**Status Card**:
The run-scoped card at the top of the dashboard main content area. Carries a `state` field (one of the run-scoped state values enumerated below) and an optional `primaryAction`. Distinct from `TrainingDetailStatus`, which is training-scoped and used on the Training page.

Run-scoped state values (consistent with existing `TrainingDetailState` naming where overlap exists):
`training_completed` · `training_aborted` · `run_completed` · `active_run_ahead` · `active_run_on_track` · `active_run_behind` · `active_run_overdue` · `scheduled_break` · `overdue_to_start_next_run` · `not_started`

_Avoid_: status banner, current status (ambiguous with TrainingDetailStatus)

## Overview

**Attempt Spectate**:
A mode within the TrainingItem overview panel where the board, PGN display, and solve time are replaced with those of another user's completed TrainingAttempt. The current user's run context (attempt history table, Next Puzzle / Retake actions) remains intact — spectating does not interrupt the current Training. Entered by clicking another user's row in the attempt history table when the user filter is set to "all users"; exited by clicking the user's own row or switching the filter back to "me". A centred label above the board identifies whose attempt is being viewed. Access-gated: the requesting user must have at least one completed TrainingAttempt on the same TrainingItem.
_Avoid_: replay mode, watch mode, other-user view

## Leaderboards

**Leaderboard Page**:
The dedicated `/app/leaderboards` page. Contains two boards — the Run Board and the Weekly Board — both scoped by an optional Schedule filter carried as a `scheduleId` query param. Visiting without a `scheduleId` shows all Schedules. The same Schedule filter applies to both boards simultaneously.
_Avoid_: leaderboard hub, stats page

**Run Board**:
A leaderboard table on the Leaderboard Page where each row represents one completed Run. Columns: position (medal icon for top 3, plain number otherwise), user, schedule (when unscoped), run index, status, start date, accuracy, avg solve time (all attempts), avg solve time when first-solved, avg solve time when failed, delta accuracy vs the previous Run in the same Training. Medal assignment tracks the active sort column — sorting by any column reassigns gold/silver/bronze. Reused on SchedulePage with a fixed `scheduleId` prop, which hides the schedule column and filter.
_Avoid_: run leaderboard, runs table

**Weekly Board**:
A leaderboard table on the Leaderboard Page where each row represents one User's aggregated performance over a rolling 7-day window ending now. Columns: position (medal icon for top 3), user, puzzles solved (default sort), avg puzzle rating (shown only for items with a numeric rating; "—" for sources without one), avg accuracy, avg solve time. Respects the same Schedule filter as the Run Board.
_Avoid_: weekly leaderboard, weekly stats

**Delta Accuracy**:
The change in accuracy percentage between a Run and the immediately preceding non-aborted Run in the same Training. Computed as `current_accuracy − previous_accuracy`, expressed in percentage points. Null when no previous Run exists. Shown on the Run Board as a signed value (e.g. +4.2% or −1.8%).
_Avoid_: accuracy improvement, accuracy change

## Admin

**Superadmin**:
A User with elevated privileges, stored as `is_superadmin: bool` on the User record (default `False`). Granted via a deploy-level CLI command; cannot be self-assigned or granted from the UI. A Superadmin has exclusive access to the Admin Page sub-pages.
_Avoid_: admin (ambiguous without the "super" qualifier in this codebase), operator (refers to the deploy-level SSH role)

**Admin Page**:
Three sub-pages under `/app/admin`, accessible only to Superadmins: Users (`/app/admin/users`), Waitlist (`/app/admin/waitlist`), and Whitelist (`/app/admin/whitelist`). Users sub-page shows `lichess_username`, `created_at`, and `last_login_at` per user. Waitlist sub-page is read-only. Whitelist sub-page supports full CRUD (add and delete entries).
_Avoid_: admin dashboard, management panel

**Last Login**:
The timestamp of a User's most recent completed Lichess OAuth callback as an existing (already-active) user. Stored as `last_login_at` (nullable) on the User record. `null` for users who have never logged back in after initial account creation. Not updated on first onboarding — only on subsequent logins.
_Avoid_: last active, last seen (both conflate login with training activity)

## Flagged ambiguities

- "puzzle" appears in the UI, old docs, and issue history — resolved: use **TrainingItem** for the stored record; "puzzle" is acceptable only in user-facing UI copy.
- "cycle" is used loosely in the Woodpecker Method description — resolved: use **Run** for the software concept.
- "nickname" was the prior code-level field name for user display identity — resolved: renamed to `display_name` everywhere (DB column, model, API, frontend) as part of issue #10.
