# Pipeline — Agent Guide

The pipeline is a standalone Python + Click CLI that imports data into the shared PostgreSQL database. It runs independently of the Flask backend but shares the same SQLAlchemy models.

## Two top-level commands

| Command | Purpose |
| --- | --- |
| `openings` | Import chess opening reference data (ECO codes, names, parent hierarchy) from TSV files |
| `lichess-tactics` | Import Lichess puzzle data: themes taxonomy, then tactics themselves |

## Docker model

Each command group has its own Docker image built from a shared base:

```txt
base.Dockerfile          → woodpecker-pipeline-base (Python + shared deps)
openings/Dockerfile      → woodpecker-pipeline-openings
sources/lichess_tactics/Dockerfile → woodpecker-pipeline-lichess-tactics
```

Build and run via the root `pipeline/Makefile`. Never run containers manually — use `make` targets.

## Local dev (no Docker)

```bash
# Add backend to PYTHONPATH so SQLAlchemy models resolve
export PYTHONPATH=/path/to/repo/backend
export DATABASE_URL=postgresql://woodpecker:woodpecker@localhost:5432/woodpecker

python cli.py openings import
python cli.py lichess-tactics themes import
python cli.py lichess-tactics tactics import --limit 1000
```

## Typical full import order

```bash
make openings-import                          # openings reference data first
make lichess-tactics-themes-import            # theme taxonomy (prerequisite for tactics)
make lichess-tactics-import                   # tactics (writes source_import_runs + metadata)
```

## What gets tracked

Only `lichess-tactics tactics import` writes a `source_import_runs` row and a `lichess_tactics_source_run_metadata` row. Openings and themes imports leave no run trace — they are reference/precursor data.

## Adding a new source

1. Create `pipeline/sources/<source_name>/` with `Dockerfile`, `Makefile`, `commands.py`, and importer logic.
2. Register the new Click group in `pipeline/cli.py`.
3. Add Makefile targets in `pipeline/Makefile`.
4. Add DB enum values and a source-specific metadata table via Alembic migrations in the backend.
