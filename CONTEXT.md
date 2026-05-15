# Woodpecker

A chess training app that operationalises the Woodpecker Method: repeatedly solving the same fixed set of puzzles in progressively shorter cycles to build tactical pattern recognition.

## Language

**TrainingItem**:
A generic, source-agnostic record for one solvable puzzle. Carries only identity and a `source_type` tag; all puzzle content (board position, solution, metadata) lives in a source-specific companion record. The solving flow operates on TrainingItems regardless of where they came from.
_Avoid_: puzzle (overloaded with UI usage), item

**Source**:
A named external puzzle data provider. Each Source has its own Pipeline importer, a source-specific metadata table, and its own solving semantics — what counts as "correct" is defined per Source, not by the generic solving engine. Current sources: `LICHESS_TACTIC`, `POSITIONAL`, `DECOY`.
_Avoid_: dataset, data source

**Lichess Tactic**:
A TrainingItem sourced from the Lichess tactics database. Solved by playing a full exact UCI move sequence. Overview shows the Lichess puzzle ID, themes, and opening.

**Positional**:
A TrainingItem from the Positional source. Solved by playing a single exact correct move (same validation logic as Lichess Tactic, just a shorter sequence). Overview shows source-specific metadata distinct from Lichess.

**Decoy**:
A TrainingItem from the Decoy source. Solved by playing any one of a set of accepted moves. This is the only source type with a non-exact-match validation rule.

**Subset**:
A user-curated collection of TrainingItems, forming the fixed puzzle set for one training cycle. A Subset can draw from one or more Sources.
_Avoid_: set, puzzle set, collection

**Schedule**:
A pre-configured training plan linking a Subset to a time-based recurrence and a specific user. The configuration determines how many Runs to perform and the target accuracy and speed for each.
_Avoid_: plan, recurring session

**Training**:
A user's active engagement with one Schedule. At most one Training exists per user per Schedule. Tracks when the user started, completed, or aborted their work through the Schedule's Runs.
_Avoid_: session, training session

**Run**:
One complete cycle through all TrainingItems in the Schedule's Subset. Belongs to a Training and is indexed within it by `run_index`. Each Run carries its own target accuracy and time limits.
_Avoid_: session, cycle

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

**Mixed-source Subset**:
A Subset composed of TrainingItems from multiple Sources (e.g. 60% Lichess Tactics, 20% Positional, 20% Decoy). Within a single Run a user may encounter any source type. The solving loop, overview stats, and attempt history are source-agnostic; only the TrainingItem metadata display varies.

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

## Flagged ambiguities

- "puzzle" appears in the UI, old docs, and issue history — resolved: use **TrainingItem** for the stored record; "puzzle" is acceptable only in user-facing UI copy.
- "cycle" is used loosely in the Woodpecker Method description — resolved: use **Run** for the software concept.
