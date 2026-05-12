SOURCE_DIR   := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
PIPELINE_DIR := $(abspath $(SOURCE_DIR)/../..)
DATABASE_URL ?= postgresql://woodpecker:woodpecker@localhost:5432/woodpecker

.PHONY: themes-ensure-data themes-import ensure-data import validate-links build

themes-ensure-data:
	cd $(PIPELINE_DIR) && python cli.py lichess-tactics themes ensure-data

themes-import:
	cd $(PIPELINE_DIR) && DATABASE_URL=$(DATABASE_URL) python cli.py lichess-tactics themes import

ensure-data:
	cd $(PIPELINE_DIR) && python cli.py lichess-tactics tactics ensure-data

import:
	cd $(PIPELINE_DIR) && DATABASE_URL=$(DATABASE_URL) python cli.py lichess-tactics tactics import $(ARGS)

validate-links:
	cd $(PIPELINE_DIR) && DATABASE_URL=$(DATABASE_URL) python cli.py lichess-tactics validate-links

build:
	docker build -f $(SOURCE_DIR)Dockerfile -t woodpecker-pipeline-lichess-tactics $(abspath $(PIPELINE_DIR)/..)
