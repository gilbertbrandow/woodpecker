PIPELINE_DIR  := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))
REPO_DIR      := $(abspath $(PIPELINE_DIR)/..)
DATABASE_URL  ?= postgresql://woodpecker:woodpecker@localhost:5432/woodpecker
DOCKER_DB_URL  = $(subst localhost,host.docker.internal,$(DATABASE_URL))
RAW_MOUNT      = -v $(PIPELINE_DIR)/data/raw:/app/pipeline/data/raw

.PHONY: build-base build-openings build-lichess-tactics \
        openings-ensure-data openings-import \
        lichess-tactics-themes-ensure-data lichess-tactics-themes-import \
        lichess-tactics-ensure-data lichess-tactics-import lichess-tactics-validate

# ── Images ─────────────────────────────────────────────────────────────────────

build-base:
	docker build -f $(PIPELINE_DIR)/base.Dockerfile -t woodpecker-pipeline-base $(REPO_DIR)

build-openings: build-base
	docker build -f $(PIPELINE_DIR)/openings/Dockerfile -t woodpecker-pipeline-openings $(REPO_DIR)

build-lichess-tactics: build-base
	docker build -f $(PIPELINE_DIR)/sources/lichess_tactics/Dockerfile -t woodpecker-pipeline-lichess-tactics $(REPO_DIR)

# ── Openings ───────────────────────────────────────────────────────────────────

openings-ensure-data: build-openings
	docker run --rm --add-host=host.docker.internal:host-gateway $(RAW_MOUNT) woodpecker-pipeline-openings openings ensure-data

openings-import: build-openings
	docker run --rm --add-host=host.docker.internal:host-gateway $(RAW_MOUNT) -e DATABASE_URL=$(DOCKER_DB_URL) woodpecker-pipeline-openings openings import

# ── Lichess tactic themes ──────────────────────────────────────────────────────

lichess-tactics-themes-ensure-data: build-lichess-tactics
	docker run --rm --add-host=host.docker.internal:host-gateway $(RAW_MOUNT) woodpecker-pipeline-lichess-tactics lichess-tactics themes ensure-data

lichess-tactics-themes-import: build-lichess-tactics
	docker run --rm --add-host=host.docker.internal:host-gateway $(RAW_MOUNT) -e DATABASE_URL=$(DOCKER_DB_URL) woodpecker-pipeline-lichess-tactics lichess-tactics themes import

# ── Lichess tactics ────────────────────────────────────────────────────────────

lichess-tactics-ensure-data: build-lichess-tactics
	docker run --rm --add-host=host.docker.internal:host-gateway $(RAW_MOUNT) woodpecker-pipeline-lichess-tactics lichess-tactics tactics ensure-data

lichess-tactics-import: build-lichess-tactics
	docker run --rm --add-host=host.docker.internal:host-gateway $(RAW_MOUNT) -e DATABASE_URL=$(DOCKER_DB_URL) woodpecker-pipeline-lichess-tactics lichess-tactics tactics import $(ARGS)

lichess-tactics-validate: build-lichess-tactics
	docker run --rm --add-host=host.docker.internal:host-gateway -e DATABASE_URL=$(DOCKER_DB_URL) woodpecker-pipeline-lichess-tactics lichess-tactics validate-links
