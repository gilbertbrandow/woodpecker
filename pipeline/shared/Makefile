SHARED_DIR    := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
PIPELINE_DIR  := $(abspath $(SHARED_DIR)/..)
DATABASE_URL  ?= postgresql://woodpecker:woodpecker@localhost:5432/woodpecker

.PHONY: ensure-data import build

ensure-data:
	cd $(PIPELINE_DIR) && python cli.py shared openings ensure-data

import:
	cd $(PIPELINE_DIR) && DATABASE_URL=$(DATABASE_URL) python cli.py shared openings import

build:
	docker build -f $(SHARED_DIR)Dockerfile -t woodpecker-pipeline-shared $(abspath $(PIPELINE_DIR)/..)
