SOURCE_DIR    := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))
PIPELINE_DIR  := $(abspath $(SOURCE_DIR)/../..)
REPO_DIR      := $(abspath $(PIPELINE_DIR)/..)
DATABASE_URL  ?= postgresql://woodpecker:woodpecker@localhost:5432/woodpecker
DOCKER_DB_URL  = $(subst localhost,host.docker.internal,$(DATABASE_URL))
RAW_MOUNT      = -v $(PIPELINE_DIR)/data/raw:/app/pipeline/data/raw

.PHONY: build themes-ensure-data themes-import ensure-data import validate-links

build:
	docker build -f $(PIPELINE_DIR)/base.Dockerfile -t woodpecker-pipeline-base $(REPO_DIR)
	docker build -f $(SOURCE_DIR)/Dockerfile -t woodpecker-pipeline-lichess-tactics $(REPO_DIR)

themes-ensure-data: build
	docker run --rm --add-host=host.docker.internal:host-gateway $(RAW_MOUNT) woodpecker-pipeline-lichess-tactics python cli.py lichess-tactics themes ensure-data

themes-import: build
	docker run --rm --add-host=host.docker.internal:host-gateway $(RAW_MOUNT) -e DATABASE_URL=$(DOCKER_DB_URL) woodpecker-pipeline-lichess-tactics python cli.py lichess-tactics themes import

ensure-data: build
	docker run --rm --add-host=host.docker.internal:host-gateway $(RAW_MOUNT) woodpecker-pipeline-lichess-tactics python cli.py lichess-tactics tactics ensure-data

import: build
	docker run --rm --add-host=host.docker.internal:host-gateway $(RAW_MOUNT) -e DATABASE_URL=$(DOCKER_DB_URL) woodpecker-pipeline-lichess-tactics python cli.py lichess-tactics tactics import $(ARGS)

validate-links: build
	docker run --rm --add-host=host.docker.internal:host-gateway -e DATABASE_URL=$(DOCKER_DB_URL) woodpecker-pipeline-lichess-tactics python cli.py lichess-tactics validate-links
