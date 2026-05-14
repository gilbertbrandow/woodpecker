DOCKER ?= docker
COMPOSE = $(DOCKER) compose
PROD_DB_URL ?= postgresql://woodpecker:SECRET@localhost:5433/woodpecker

# EC2 / production database helpers.
# Run from the repo root with `make -C deploy <target>` or from inside deploy/.
#
# Typical production DB tunnel flow:
#   make -C deploy db-expose-ec2 EC2_HOST=<host>
#   make -C deploy db-tunnel-ec2 EC2_HOST=<host>
#
# In a separate terminal, run pipeline commands against the tunnel:
#   make -C deploy lichess-tactics-validate PROD_DB_URL="postgresql://woodpecker:SECRET@localhost:5433/woodpecker"

db-shell-ec2:
	ssh -t ubuntu@$(EC2_HOST) "cd /opt/woodpecker && docker compose -f docker-compose.yml -f docker-compose-prod.yml exec db psql -U woodpecker woodpecker"

db-expose-ec2:
	ssh ubuntu@$(EC2_HOST) "cd /opt/woodpecker && docker compose -f docker-compose.yml -f docker-compose-prod.yml -f docker-compose-db-tunnel.yml up -d --no-deps db"
	@echo "DB port now bound to 127.0.0.1:5432 on EC2. Run 'make -C deploy db-tunnel-ec2' in a new terminal."

db-tunnel-ec2:
	@echo "Forwarding localhost:5433 → EC2 db. Ctrl-C to close."
	ssh -N -L 5433:localhost:5432 ubuntu@$(EC2_HOST)

db-unexpose-ec2:
	ssh ubuntu@$(EC2_HOST) "cd /opt/woodpecker && docker compose -f docker-compose.yml -f docker-compose-prod.yml up -d db"

lichess-tactics-validate:
	DATABASE_URL=$(PROD_DB_URL) $(MAKE) -C ../pipeline lichess-tactics-validate

lichess-tactics-relink-openings:
	DATABASE_URL=$(PROD_DB_URL) $(MAKE) -C ../pipeline lichess-tactics-relink-openings

.PHONY: db-shell-ec2 db-expose-ec2 db-tunnel-ec2 db-unexpose-ec2 lichess-tactics-validate lichess-tactics-relink-openings
