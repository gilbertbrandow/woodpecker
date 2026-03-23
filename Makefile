LOCAL_COMPOSE = sudo docker compose -f docker-compose.yml -f docker-compose-local.yml
PROD_COMPOSE  = sudo docker compose -f docker-compose.yml -f docker-compose-prod.yml

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

puzzle-copy:
	$(LOCAL_COMPOSE) cp $(file) backend:/tmp/lichess_db_puzzle.csv.zst

puzzle-import:
	$(LOCAL_COMPOSE) exec backend flask --app app puzzles import --file /tmp/lichess_db_puzzle.csv.zst $(args)

puzzle-copy-prod:
	$(PROD_COMPOSE) cp $(file) backend:/tmp/lichess_db_puzzle.csv.zst

puzzle-import-prod:
	$(PROD_COMPOSE) exec backend flask --app app puzzles import --file /tmp/lichess_db_puzzle.csv.zst $(args)

openings-import:
	$(LOCAL_COMPOSE) exec backend flask --app app openings import $(args)

openings-import-prod:
	$(PROD_COMPOSE) exec backend flask --app app openings import $(args)

.PHONY: up up-build down logs ps build shell-backend shell-db migrate-init migrate migrate-upgrade puzzle-copy puzzle-import puzzle-copy-prod puzzle-import-prod openings-import openings-import-prod
