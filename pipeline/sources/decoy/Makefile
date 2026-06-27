SOURCE_DIR    := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))
PIPELINE_DIR  := $(abspath $(SOURCE_DIR)/../..)
REPO_DIR      := $(abspath $(PIPELINE_DIR)/..)
DATABASE_URL  ?= postgresql://woodpecker:woodpecker@localhost:5432/woodpecker
DOCKER_DB_URL  = $(subst localhost,host.docker.internal,$(DATABASE_URL))
RAW_MOUNT      = -v $(PIPELINE_DIR)/data/raw:/app/pipeline/data/raw

.PHONY: build import

build:
	docker build -f $(PIPELINE_DIR)/base.Dockerfile -t woodpecker-pipeline-base $(REPO_DIR)
	docker build -f $(SOURCE_DIR)/Dockerfile -t woodpecker-pipeline-decoy $(REPO_DIR)

# Import a generated JSONL file into the production database
import: build
	@[ -n "$(FILE)" ] || (echo "error: FILE is required  Usage: make import FILE=<path>" >&2 && exit 1)
	docker run --rm --add-host=host.docker.internal:host-gateway $(RAW_MOUNT) \
		-v $(FILE):/data/decoys.jsonl:ro \
		-e DATABASE_URL=$(DOCKER_DB_URL) \
		woodpecker-pipeline-decoy decoy puzzles import --file /data/decoys.jsonl $(ARGS)
