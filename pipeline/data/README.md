# Pipeline data directory

`sources.yml` documents where each source file comes from.

`raw/` holds downloaded source files (gitignored). Pipeline commands download missing files automatically on first run.

`cache/` holds intermediate processed data (gitignored).

Run pipeline commands via `make` from the repo root (Docker required):

```bash
make -C pipeline import-openings
make -C pipeline import-lichess-tactics ARGS="--limit 1000"
make -C pipeline import-scraped-positional ARGS="--limit 1000"
```

---

## Adding a new source

Each data source lives under `pipeline/sources/<source_name>/` and follows this structure:

```text
pipeline/sources/<source_name>/
    Dockerfile          FROM woodpecker-pipeline-base
    Makefile            granular targets (build, ensure-data, import, import-all)
    requirements.txt    source-specific Python deps only
    commands.py         Click command group registered into cli.py
    importer.py         core import logic — process_<source>_batch() as a top-level function
```

After creating those files, do three things:

**1. Add the source URL to `pipeline/data/sources.yml`:**

```yaml
new_source:
  - name: data-file.csv
    url: https://example.com/data-file.csv
```

**2. Register the command group in `pipeline/cli.py`:**

```python
from sources.new_source.commands import new_source
cli.add_command(new_source)
```

**3. Add build and import targets to `pipeline/Makefile`:**

```makefile
build-new-source: build-base
    docker build -f $(PIPELINE_DIR)/sources/new_source/Dockerfile -t woodpecker-pipeline-new-source $(REPO_DIR)

import-new-source: build-new-source
    docker run --rm --add-host=host.docker.internal:host-gateway \
        $(RAW_MOUNT) -e DATABASE_URL=$(DOCKER_DB_URL) \
        woodpecker-pipeline-new-source python cli.py new-source import-all $(ARGS)
```

Use `ensure_source_file("new_source")` in `commands.py` to resolve the download path, and wrap import commands with `execute_import_run` from `run_support.py`. See `sources/scraped_positional/` as the reference implementation.
