# Pipeline — Agent Guide

The pipeline is a standalone Python + Click CLI that imports data into the shared PostgreSQL database. It runs independently of the Flask backend but shares the same SQLAlchemy models.

## Three top-level command groups

| Command group | Purpose |
| --- | --- |
| `openings` | Import chess opening reference data (ECO codes, names, parent hierarchy) |
| `lichess-tactics` | Import Lichess puzzle data: themes taxonomy, then tactics with theme and opening links |
| `positional` | Import scraped positional puzzles: difficulty tiers, themes taxonomy, then puzzles with FEN enrichment |

## Docker model

Each command group has its own Docker image built from a shared base:

```txt
base.Dockerfile                             → woodpecker-pipeline-base
openings/Dockerfile                         → woodpecker-pipeline-openings
sources/lichess_tactics/Dockerfile          → woodpecker-pipeline-lichess-tactics
sources/scraped_positional/Dockerfile       → woodpecker-pipeline-scraped-positional
```

The root `pipeline/Makefile` exposes one high-level import target per source. Granular targets (seed lookup tables, validate links, etc.) live in each source's own Makefile.

## Local dev (no Docker)

```bash
export PYTHONPATH=/path/to/repo/backend
export DATABASE_URL=postgresql://woodpecker:woodpecker@localhost:5432/woodpecker

python cli.py openings import
python cli.py lichess-tactics themes import
python cli.py lichess-tactics tactics import --limit 1000
python cli.py positional import-all --limit 1000
```

## Typical full import order

```bash
make -C pipeline import-openings                                      # reference data first
make -C pipeline import-lichess-tactics ARGS="--limit 1000"          # themes then tactics
make -C pipeline import-scraped-positional ARGS="--limit 1000"       # difficulties, themes, puzzles
```

## Shared modules

| Module | Purpose |
| --- | --- |
| `db.py` | SQLAlchemy session factory — reads `DATABASE_URL` from env |
| `downloader.py` | `ensure_file` (streaming HTTP download) and `ensure_source_file(key)` (looks up `data/sources.yml` and calls `ensure_file`) |
| `run_support.py` | `execute_import_run` — wraps any import fn in the `RUNNING → SUCCEEDED/FAILED` SourceImportRun lifecycle |
| `cli.py` | Registers all command groups into the top-level Click CLI |

## Source layout

Each source follows this structure:

```text
pipeline/sources/<source_name>/
    Dockerfile          FROM woodpecker-pipeline-base, installs source-specific deps
    Makefile            granular targets (build, ensure-data, import, import-all, ...)
    requirements.txt    source-specific Python deps only
    commands.py         Click command group — calls execute_import_run for import commands
    importer.py         core import logic — standalone functions callable in tests
```

`openings/` follows the same layout but lives directly under `pipeline/` rather than `pipeline/sources/`.

## Source import pattern

Every import command follows the same shape in `commands.py`:

```python
def import_cmd(...) -> None:
    file = ensure_source_file("source_key")
    with Session() as session:
        execute_import_run(
            session,
            source=SourceImportSource.X,
            operation=SourceImportOperation.X_IMPORT,
            parameters={...},
            summary_keys=[...],
            fn=lambda sess, run_id: import_fn(sess, file, run_id, ...),
            metadata_factory=lambda run_id, stats, generated_at: XSourceRunMetadata(...),
        )
```

`execute_import_run` (in `run_support.py`) owns the run lifecycle: creates the RUNNING record, calls `fn`, writes the metadata row, marks SUCCEEDED or FAILED.

## Batch processor pattern

Each source's core import function processes CSV rows in batches. The batch logic lives in a standalone top-level function (e.g. `process_puzzle_batch`, `process_tactic_batch`) that takes a session, a list of row dicts, caches, and run ID, and returns a typed result dataclass. This makes the dedup/insert/pivot logic directly testable without running a full end-to-end import.

## Adding a new source

See [data/README.md](data/README.md) for step-by-step instructions.
