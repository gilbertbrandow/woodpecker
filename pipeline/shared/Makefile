SHARED_DIR    := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))
PIPELINE_DIR  := $(abspath $(SHARED_DIR)/..)
REPO_DIR      := $(abspath $(PIPELINE_DIR)/..)
DATABASE_URL  ?= postgresql://woodpecker:woodpecker@localhost:5432/woodpecker
DOCKER_DB_URL  = $(subst localhost,host.docker.internal,$(DATABASE_URL))
RAW_MOUNT      = -v $(PIPELINE_DIR)/data/raw:/app/pipeline/data/raw

.PHONY: build ensure-data import

build:
	docker build -f $(PIPELINE_DIR)/base.Dockerfile -t woodpecker-pipeline-base $(REPO_DIR)
	docker build -f $(SHARED_DIR)/Dockerfile -t woodpecker-pipeline-shared $(REPO_DIR)

ensure-data: build
	docker run --rm $(RAW_MOUNT) woodpecker-pipeline-shared python cli.py shared openings ensure-data

import: build
	docker run --rm $(RAW_MOUNT) -e DATABASE_URL=$(DOCKER_DB_URL) woodpecker-pipeline-shared python cli.py shared openings import
