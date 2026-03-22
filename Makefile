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

.PHONY: up up-build down logs ps build shell-backend shell-db
