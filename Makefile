DOCKER ?= docker
COMPOSE = $(DOCKER) compose
LOCAL_COMPOSE = $(COMPOSE) -f docker-compose.yml -f docker-compose-local.yml
TEST_COMPOSE  = $(COMPOSE) --project-name woodpecker-test -f docker-compose.yml -f docker-compose-test.yml
SEED_DEV_LIMIT ?= 10000


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
	$(MAKE) -C pipeline import-openings
	$(MAKE) -C pipeline import-lichess-tactics ARGS="--limit $(SEED_DEV_LIMIT)"
	$(MAKE) -C pipeline import-scraped-positional

setup:
	$(MAKE) -C backend setup
	$(MAKE) -C frontend setup

lint:
	$(MAKE) -C backend lint
	$(MAKE) -C frontend lint

test:
	$(LOCAL_COMPOSE) build --quiet backend frontend
	$(LOCAL_COMPOSE) run --rm backend pytest -m "not integration"
	$(LOCAL_COMPOSE) run --rm frontend sh -c "npm install && npm run test:run"

test-integration:
	$(TEST_COMPOSE) build --quiet backend
	$(TEST_COMPOSE) run --rm backend sh -c "flask --app app db upgrade && pytest -m integration"
	$(TEST_COMPOSE) down -v

test-all:
	$(TEST_COMPOSE) build --quiet backend
	$(TEST_COMPOSE) run --rm backend sh -c "flask --app app db upgrade && pytest"
	$(MAKE) -C frontend test
	$(TEST_COMPOSE) down -v

.PHONY: up up-build down logs ps build shell-backend shell-db migrate-init migrate migrate-upgrade migrate-current migrate-history migrate-rollback seed-dev setup lint test test-integration test-all
