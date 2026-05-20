PIPELINE_DIR  := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))
REPO_DIR      := $(abspath $(PIPELINE_DIR)/..)
DATABASE_URL  ?= postgresql://woodpecker:woodpecker@localhost:5432/woodpecker
DOCKER_DB_URL  = $(subst localhost,host.docker.internal,$(DATABASE_URL))
RAW_MOUNT      = -v $(PIPELINE_DIR)/data/raw:/app/pipeline/data/raw

.PHONY: build-base build-openings build-lichess-tactics build-scraped-positional \
        import-openings import-lichess-tactics import-scraped-positional

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
