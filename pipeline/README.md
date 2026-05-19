# Pipeline

Standalone Python + Click CLI that imports chess puzzle data from external sources into the shared PostgreSQL database. Runs independently of the Flask backend but shares the same SQLAlchemy models.

## Sources

| Source | Make target | What it imports |
| --- | --- | --- |
| Openings | `import-openings` | ECO opening reference data (prerequisite for tactics) |
| Lichess tactics | `import-lichess-tactics` | Lichess puzzle database with themes and openings |
| Scraped positional | `import-scraped-positional` | Positional puzzles with difficulty tiers and themes |

## Running with Docker

From the repo root — images are built automatically:

```bash
make -C pipeline import-openings
make -C pipeline import-lichess-tactics ARGS="--limit 1000"
make -C pipeline import-scraped-positional ARGS="--limit 1000"
```

Run in this order: openings must precede tactics (theme and opening lookups depend on it). Each command downloads source data automatically on first run.

## Running locally (no Docker)

```bash
export PYTHONPATH=/path/to/repo/backend
export DATABASE_URL=postgresql://woodpecker:woodpecker@localhost:5432/woodpecker

cd pipeline
python cli.py openings import
python cli.py lichess-tactics themes import
python cli.py lichess-tactics tactics import --limit 1000
python cli.py positional import-all --limit 1000
```

## Granular targets

Each source exposes its own Makefile for finer-grained control:

| Makefile | Key targets |
| --- | --- |
| `pipeline/openings/Makefile` | `ensure-data`, `import` |
| `pipeline/sources/lichess_tactics/Makefile` | `themes-import`, `import`, `import-all`, `validate-links` |
| `pipeline/sources/scraped_positional/Makefile` | `difficulties-import`, `themes-import`, `import`, `import-all` |

See [data/README.md](data/README.md) for the source manifest and a guide for adding a new source.
