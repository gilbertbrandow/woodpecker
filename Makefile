DOCKER ?= docker
COMPOSE = $(DOCKER) compose
LOCAL_COMPOSE = $(COMPOSE) -f docker-compose.yml -f docker-compose-local.yml
SEED_DEV_LIMIT ?= 1000

up:
	$(LOCAL_COMPOSE) up

up-build:
	$(LOCAL_COMPOSE) up --build

down:
	$(LOCAL_COMPOSE) down

logs:
	$(LOCAL_COMPOSE) logs -f

ps:
	$(LOCAL_COMPOSE) ps

build:
	$(LOCAL_COMPOSE) build

shell-backend:
	$(LOCAL_COMPOSE) exec backend bash

shell-db:
	$(LOCAL_COMPOSE) exec db psql -U woodpecker woodpecker

migrate-init:
	$(LOCAL_COMPOSE) exec backend flask --app app db init

migrate:
	$(LOCAL_COMPOSE) exec backend flask --app app db migrate -m "$(msg)"

migrate-upgrade:
	$(LOCAL_COMPOSE) exec backend flask --app app db upgrade

migrate-current:
	$(LOCAL_COMPOSE) exec backend flask --app app db current

migrate-history:
	$(LOCAL_COMPOSE) exec backend flask --app app db history

migrate-rollback:
	$(LOCAL_COMPOSE) exec backend flask --app app db downgrade $(rev)

seed-dev:
	$(MAKE) -C pipeline shared-openings-import
	$(MAKE) -C pipeline lichess-tactics-themes-import
	$(MAKE) -C pipeline lichess-tactics-import ARGS="--limit $(SEED_DEV_LIMIT)"

test-frontend:
	cd frontend && . $${NVM_DIR:-$$HOME/.nvm}/nvm.sh && nvm install --no-progress && npm install && npm run test:run

test-backend:
	cd backend && .venv/bin/pytest -m "not integration"

test-backend-integration:
	cd backend && .venv/bin/pytest -m integration

test: test-frontend test-backend

test-integration: test-backend-integration

test-frontend-docker:
	$(LOCAL_COMPOSE) run --rm frontend npm run test:run

test-backend-docker:
	$(LOCAL_COMPOSE) run --rm backend pytest

test-docker:
	$(MAKE) test-frontend-docker
	$(MAKE) test-backend-docker

.PHONY: up up-build down logs ps build shell-backend shell-db migrate-init migrate migrate-upgrade migrate-current migrate-history migrate-rollback seed-dev test-frontend test-backend test-backend-integration test-integration test test-frontend-docker test-backend-docker test-docker
