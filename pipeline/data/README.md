# Pipeline data directory

`sources.yml` documents where each source file comes from.

`raw/` holds downloaded source files (gitignored). Pipeline commands download missing files automatically.

`cache/` holds intermediate processed data (gitignored).

Run pipeline commands via `make` from the repo root (Docker is required):

```bash
# Shared reference data — must run before lichess tactics
make -C pipeline shared-openings-import

# Lichess tactic themes — must run before tactics
make -C pipeline lichess-tactics-themes-import

# Lichess tactics (~1 GB download, takes a while)
make -C pipeline lichess-tactics-import

# Validate that links are correct after import
make -C pipeline lichess-tactics-validate
```

---

## Adding a new source

Each data source lives under `pipeline/sources/<source_name>/` and follows this structure:

```text
pipeline/sources/<source_name>/
    Dockerfile          FROM woodpecker-pipeline-base:latest
                        RUN pip install -r /app/pipeline/sources/<source_name>/requirements.txt
    Makefile            build, ensure-data, import targets (see lichess_tactics/Makefile)
    requirements.txt    source-specific Python deps only
    commands.py         Click command group registered into cli.py
    importer.py         core import logic (use standalone SQLAlchemy session from db.py)
```

After creating those files, do two things:

**1. Register the command group in `pipeline/cli.py`:**

```python
from sources.new_source.commands import new_source
cli.add_command(new_source)
```

**2. Add build/import targets to `pipeline/Makefile`:**

```makefile
build-new-source: build-base
    docker build -f $(PIPELINE_DIR)/sources/new_source/Dockerfile -t woodpecker-pipeline-new-source $(REPO_DIR)

new-source-import: build-new-source
    docker run --rm --add-host=host.docker.internal:host-gateway \
        $(RAW_MOUNT) -e DATABASE_URL=$(DOCKER_DB_URL) \
        woodpecker-pipeline-new-source python cli.py new-source import
```

See `pipeline/sources/lichess_tactics/` as the reference implementation.
