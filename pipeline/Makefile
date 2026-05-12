PIPELINE_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
DATABASE_URL ?= postgresql://woodpecker:woodpecker@localhost:5432/woodpecker

.PHONY: shared-openings-ensure-data shared-openings-import \
        lichess-tactics-themes-ensure-data lichess-tactics-themes-import \
        lichess-tactics-ensure-data lichess-tactics-import lichess-tactics-validate

shared-openings-ensure-data:
	cd $(PIPELINE_DIR) && python cli.py shared openings ensure-data

shared-openings-import:
	cd $(PIPELINE_DIR) && DATABASE_URL=$(DATABASE_URL) python cli.py shared openings import

lichess-tactics-themes-ensure-data:
	cd $(PIPELINE_DIR) && python cli.py lichess-tactics themes ensure-data

lichess-tactics-themes-import:
	cd $(PIPELINE_DIR) && DATABASE_URL=$(DATABASE_URL) python cli.py lichess-tactics themes import

lichess-tactics-ensure-data:
	cd $(PIPELINE_DIR) && python cli.py lichess-tactics tactics ensure-data

lichess-tactics-import:
	cd $(PIPELINE_DIR) && DATABASE_URL=$(DATABASE_URL) python cli.py lichess-tactics tactics import $(ARGS)

lichess-tactics-validate:
	cd $(PIPELINE_DIR) && DATABASE_URL=$(DATABASE_URL) python cli.py lichess-tactics validate-links
