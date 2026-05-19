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
