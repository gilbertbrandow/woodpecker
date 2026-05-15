# Woodpecker

A chess training app that operationalises the Woodpecker Method: repeatedly solving the same fixed set of puzzles in progressively shorter cycles to build tactical pattern recognition.

## Language

**TrainingItem**:
A generic, source-agnostic record for one solvable puzzle. The solving flow operates on TrainingItems regardless of where they came from.
_Avoid_: puzzle (overloaded with UI usage), item

**Source**:
A named external puzzle data provider (e.g. `lichess-tactics`, `openings`). Each Source has its own Pipeline importer and source-specific metadata table in the database.
_Avoid_: dataset, data source

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
