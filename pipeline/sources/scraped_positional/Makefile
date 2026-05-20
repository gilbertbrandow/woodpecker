SOURCE_DIR    := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))
PIPELINE_DIR  := $(abspath $(SOURCE_DIR)/../..)
REPO_DIR      := $(abspath $(PIPELINE_DIR)/..)
DATABASE_URL  ?= postgresql://woodpecker:woodpecker@localhost:5432/woodpecker
DOCKER_DB_URL  = $(subst localhost,host.docker.internal,$(DATABASE_URL))
RAW_MOUNT      = -v $(PIPELINE_DIR)/data/raw:/app/pipeline/data/raw

.PHONY: build difficulties-import themes-import ensure-data import import-all

build:
	docker build -f $(PIPELINE_DIR)/base.Dockerfile -t woodpecker-pipeline-base $(REPO_DIR)
	docker build -f $(SOURCE_DIR)/Dockerfile -t woodpecker-pipeline-scraped-positional $(REPO_DIR)

difficulties-import: build
	docker run --rm --add-host=host.docker.internal:host-gateway -e DATABASE_URL=$(DOCKER_DB_URL) woodpecker-pipeline-scraped-positional positional difficulties import

themes-import: build
	docker run --rm --add-host=host.docker.internal:host-gateway -e DATABASE_URL=$(DOCKER_DB_URL) woodpecker-pipeline-scraped-positional positional themes import

ensure-data: build
	docker run --rm --add-host=host.docker.internal:host-gateway $(RAW_MOUNT) woodpecker-pipeline-scraped-positional positional puzzles ensure-data

import: build
	docker run --rm --add-host=host.docker.internal:host-gateway $(RAW_MOUNT) -e DATABASE_URL=$(DOCKER_DB_URL) woodpecker-pipeline-scraped-positional positional puzzles import $(ARGS)

import-all: build
	docker run --rm --add-host=host.docker.internal:host-gateway $(RAW_MOUNT) -e DATABASE_URL=$(DOCKER_DB_URL) woodpecker-pipeline-scraped-positional positional import-all $(ARGS)
