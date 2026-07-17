PIPELINE_DIR  := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))
REPO_DIR      := $(abspath $(PIPELINE_DIR)/..)
DATABASE_URL  ?= postgresql://woodpecker:woodpecker@localhost:5432/woodpecker
DOCKER_DB_URL  = $(subst localhost,host.docker.internal,$(DATABASE_URL))
RAW_MOUNT      = -v $(PIPELINE_DIR)/data/raw:/app/pipeline/data/raw

.PHONY: setup lint \
        build-base build-openings build-lichess-tactics build-scraped-positional \
        import-openings import-lichess-tactics import-scraped-positional \
        generate-decoy-dataset import-decoy-positions

# ── Dev tooling ────────────────────────────────────────────────────────────────

setup:
	python3 -m venv $(PIPELINE_DIR)/.venv
	$(PIPELINE_DIR)/.venv/bin/pip install --upgrade pip
	$(PIPELINE_DIR)/.venv/bin/pip install -r $(PIPELINE_DIR)/requirements.txt

lint:
	$(PIPELINE_DIR)/.venv/bin/ruff check $(PIPELINE_DIR)
	cd $(REPO_DIR) && $(REPO_DIR)/backend/.venv/bin/mypy pipeline/

# ── Images ─────────────────────────────────────────────────────────────────────

build-base:
	docker build -f $(PIPELINE_DIR)/base.Dockerfile -t woodpecker-pipeline-base $(REPO_DIR)

build-openings: build-base
	docker build -f $(PIPELINE_DIR)/openings/Dockerfile -t woodpecker-pipeline-openings $(REPO_DIR)

build-lichess-tactics: build-base
	docker build -f $(PIPELINE_DIR)/sources/lichess_tactics/Dockerfile -t woodpecker-pipeline-lichess-tactics $(REPO_DIR)

build-scraped-positional: build-base
	docker build -f $(PIPELINE_DIR)/sources/scraped_positional/Dockerfile -t woodpecker-pipeline-scraped-positional $(REPO_DIR)

# ── Openings ───────────────────────────────────────────────────────────────────

import-openings: build-openings
	docker run --rm --add-host=host.docker.internal:host-gateway $(RAW_MOUNT) -e DATABASE_URL=$(DOCKER_DB_URL) woodpecker-pipeline-openings openings import

# ── Lichess tactics ────────────────────────────────────────────────────────────

import-lichess-tactics: build-lichess-tactics
	docker run --rm --add-host=host.docker.internal:host-gateway $(RAW_MOUNT) -e DATABASE_URL=$(DOCKER_DB_URL) woodpecker-pipeline-lichess-tactics lichess-tactics themes import
	docker run --rm --add-host=host.docker.internal:host-gateway $(RAW_MOUNT) -e DATABASE_URL=$(DOCKER_DB_URL) woodpecker-pipeline-lichess-tactics lichess-tactics tactics import $(ARGS)

# ── Scraped positional ─────────────────────────────────────────────────────────

import-scraped-positional: build-scraped-positional
	docker run --rm --add-host=host.docker.internal:host-gateway $(RAW_MOUNT) -e DATABASE_URL=$(DOCKER_DB_URL) woodpecker-pipeline-scraped-positional positional import-all $(ARGS)

# ── Decoy positions ────────────────────────────────────────────────────────────
# Two separate steps:
#
#   generate-decoy-dataset   Scans 100k+ OTB master games, queries Lichess API,
#                            and publishes decoy_positions.jsonl to HuggingFace.
#                            Takes 3-6 hours. Requires LICHESS_TOKEN + HF credentials.
#                            Only needs to run once (or when refreshing the dataset).
#
#   import-decoy-positions   Imports decoy positions into the database. Downloads
#                            decoy_positions.jsonl from HuggingFace automatically
#                            (cached in pipeline/data/raw/). Pass FILE=<path> to
#                            use a local file instead. Fast and repeatable.

generate-decoy-dataset:
	@echo "⚠  WARNING: This takes 3-6 hours and requires LICHESS_TOKEN and HuggingFace credentials."
	@echo "   Press Ctrl+C to abort, or wait 5 seconds to continue..."
	@sleep 5
	$(MAKE) -C $(PIPELINE_DIR)/sources/decoy/generate docker-all LICHESS_TOKEN=$(LICHESS_TOKEN)

import-decoy-positions:
	docker build -f $(PIPELINE_DIR)/sources/decoy/Dockerfile -t woodpecker-pipeline-decoy $(REPO_DIR)
	docker run --rm --add-host=host.docker.internal:host-gateway $(RAW_MOUNT) \
		-e DATABASE_URL=$(DOCKER_DB_URL) \
		woodpecker-pipeline-decoy decoy puzzles import $(if $(FILE),--file $(FILE),) $(ARGS)
