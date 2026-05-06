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

migrate-current:
	$(LOCAL_COMPOSE) exec backend flask --app app db current

migrate-history:
	$(LOCAL_COMPOSE) exec backend flask --app app db history

migrate-rollback:
	$(LOCAL_COMPOSE) exec backend flask --app app db downgrade $(rev)

puzzle-copy:
	$(LOCAL_COMPOSE) cp $(file) backend:/tmp/lichess_db_puzzle.csv.zst

puzzle-import:
	$(LOCAL_COMPOSE) exec backend flask --app app puzzles import --file /tmp/lichess_db_puzzle.csv.zst $(args)

openings-import:
	$(LOCAL_COMPOSE) exec backend flask --app app openings import $(args)

test-frontend:
	cd frontend && npm run test:run

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

puzzle-seed-ec2:
	scp $(file) ubuntu@$(EC2_HOST):/tmp/lichess_db_puzzle.csv.zst
	ssh ubuntu@$(EC2_HOST) "cd /opt/woodpecker && docker compose cp /tmp/lichess_db_puzzle.csv.zst backend:/tmp/"
	ssh ubuntu@$(EC2_HOST) "cd /opt/woodpecker && docker compose -f docker-compose.yml -f docker-compose-prod.yml exec -T backend flask --app app puzzles import --file /tmp/lichess_db_puzzle.csv.zst $(args)"
	ssh ubuntu@$(EC2_HOST) "rm /tmp/lichess_db_puzzle.csv.zst"

db-shell-ec2:
	ssh -t ubuntu@$(EC2_HOST) "cd /opt/woodpecker && docker compose -f docker-compose.yml -f docker-compose-prod.yml exec db psql -U woodpecker woodpecker"

db-expose-ec2:
	ssh ubuntu@$(EC2_HOST) "cd /opt/woodpecker && docker compose -f docker-compose.yml -f docker-compose-prod.yml -f docker-compose-db-tunnel.yml up -d db"
	@echo "DB port now bound to 127.0.0.1:5432 on EC2. Run 'make db-tunnel-ec2' in a new terminal."

db-tunnel-ec2:
	@echo "Forwarding localhost:5433 → EC2 db. Ctrl-C to close."
	ssh -N -L 5433:localhost:5432 ubuntu@$(EC2_HOST)

db-unexpose-ec2:
	ssh ubuntu@$(EC2_HOST) "cd /opt/woodpecker && docker compose -f docker-compose.yml -f docker-compose-prod.yml up -d db"

.PHONY: up up-build down logs ps build shell-backend shell-db migrate-init migrate migrate-upgrade migrate-current migrate-history migrate-rollback puzzle-copy puzzle-import openings-import test-frontend test-backend test-backend-integration test-integration test test-frontend-docker test-backend-docker test-docker puzzle-seed-ec2 db-shell-ec2 db-expose-ec2 db-tunnel-ec2 db-unexpose-ec2
