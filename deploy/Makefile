DOCKER  ?= docker
COMPOSE  = $(DOCKER) compose

DEPLOY_DIR  := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))
SCRIPTS_DIR := $(DEPLOY_DIR)/scripts

-include $(HOME)/.woodpecker-prod-env

PROD_DB_URL = postgresql://woodpecker:$(PROD_DB_PASSWORD)@localhost:5433/woodpecker

PROD_DB_DOCKER_URL = postgresql://woodpecker:$(PROD_DB_PASSWORD)@host.docker.internal:5433/woodpecker

# ENV=prod (default) connects via the SSH tunnel on localhost:5433.
# ENV=local connects to the local Docker dev DB directly.
ENV ?= prod
ifeq ($(ENV),local)
  _DB_SHELL = $(COMPOSE) -f $(DEPLOY_DIR)/../docker-compose.yml exec db psql -U woodpecker woodpecker
  _DB_EXEC  = $(COMPOSE) -f $(DEPLOY_DIR)/../docker-compose.yml exec -T db psql -U woodpecker woodpecker
else
  _DB_SHELL = PGPASSWORD=$(PROD_DB_PASSWORD) psql -h localhost -p 5433 -U woodpecker woodpecker
  _DB_EXEC  = PGPASSWORD=$(PROD_DB_PASSWORD) psql -h localhost -p 5433 -U woodpecker woodpecker
endif

# ── Local dev against prod DB ───────────────────────────────────────────────────

up-local-prod-db:
	@printf "[PRODUCTION] WARNING: The local backend will connect to the production database.\nType 'yes' to continue: "; \
	read confirm; \
	[ "$$confirm" = "yes" ] || { echo "Aborted."; exit 1; }
	@$(MAKE) -s db-tunnel-start
	@$(COMPOSE) \
	  -f $(DEPLOY_DIR)/../docker-compose.yml \
	  -f $(DEPLOY_DIR)/../docker-compose-local.yml \
	  down
	@PROD_DB_PASSWORD=$(PROD_DB_PASSWORD) \
	  $(COMPOSE) -f $(DEPLOY_DIR)/../docker-compose.yml \
	  -f $(DEPLOY_DIR)/../docker-compose-local.yml \
	  -f $(DEPLOY_DIR)/docker-compose-prod-db.yml \
	  up

# ── Tunnel ─────────────────────────────────────────────────────────────────────

db-tunnel-start:
	@$(SCRIPTS_DIR)/db-tunnel-prod.sh start

db-tunnel-stop:
	@$(SCRIPTS_DIR)/db-tunnel-prod.sh stop

# ── DB access ──────────────────────────────────────────────────────────────────

db-shell:
	@$(_DB_SHELL)

db-shell-ec2:
	ssh -t ubuntu@$(EC2_HOST) "cd /opt/woodpecker && docker compose -f docker-compose.yml -f docker-compose-prod.yml exec db psql -U woodpecker woodpecker"

db-query:
	@$(_DB_EXEC) -c "$(SQL)"

db-explain:
	@$(_DB_EXEC) -c "EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) $(SQL)"

db-table-sizes:
	@$(_DB_EXEC) -c \
	"SELECT relname AS table, n_live_tup AS rows, pg_size_pretty(pg_total_relation_size(relid)) AS total_size, pg_size_pretty(pg_relation_size(relid)) AS table_size, pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS index_size FROM pg_stat_user_tables ORDER BY n_live_tup DESC;"

db-index-stats:
	@$(_DB_EXEC) -c \
	"SELECT t.relname AS table, t.seq_scan, t.idx_scan, t.n_live_tup AS rows, i.indexrelname AS index, i.idx_scan AS index_scans FROM pg_stat_user_tables t LEFT JOIN pg_stat_user_indexes i ON i.relid = t.relid ORDER BY t.seq_scan DESC, t.relname, i.idx_scan;"

# ── Pipeline (prod) ────────────────────────────────────────────────────────────

_confirm-prod-mutation:
	@printf "[PRODUCTION] WARNING: This will mutate production data.\nType 'yes' to continue: "; \
	read confirm; \
	[ "$$confirm" = "yes" ] || { echo "Aborted."; exit 1; }

prod-lichess-tactics-validate:
	@DATABASE_URL=$(PROD_DB_URL) $(MAKE) -s -C ../pipeline lichess-tactics-validate

prod-lichess-tactics-import: _confirm-prod-mutation
	@DATABASE_URL=$(PROD_DB_URL) $(MAKE) -s -C ../pipeline lichess-tactics-import ARGS="$(ARGS)"

prod-lichess-tactics-themes-import: _confirm-prod-mutation
	@DATABASE_URL=$(PROD_DB_URL) $(MAKE) -s -C ../pipeline lichess-tactics-themes-import

prod-openings-import: _confirm-prod-mutation
	@DATABASE_URL=$(PROD_DB_URL) $(MAKE) -s -C ../pipeline openings-import

prod-scraped-positional-import: _confirm-prod-mutation
	@DATABASE_URL=$(PROD_DB_URL) $(MAKE) -s -C ../pipeline import-scraped-positional ARGS="$(ARGS)"

prod-decoy-import: _confirm-prod-mutation
	@DATABASE_URL=$(PROD_DB_URL) $(MAKE) -s -C ../pipeline import-decoy-positions FILE="$(FILE)" ARGS="$(ARGS)"

prod-migrate: _confirm-prod-mutation
	@DATABASE_URL=$(PROD_DB_URL) $(MAKE) -s -C ../backend migrate

# ── Backup ─────────────────────────────────────────────────────────────────────

db-backup-now:
	ssh ubuntu@$(EC2_HOST) "sudo systemctl start woodpecker-backup.service && journalctl -u woodpecker-backup.service -n 80 --no-pager"

# ── Backup validation ──────────────────────────────────────────────────────────

db-backup-validate-latest:
	@$(SCRIPTS_DIR)/validate-db-backup.sh

db-backup-validate:
	@S3_KEY="$(S3_KEY)" $(SCRIPTS_DIR)/validate-db-backup.sh

db-backup-validate-clean:
	@docker rm -f woodpecker-validate-db 2>/dev/null || true
	@docker volume rm woodpecker-validate-db-data 2>/dev/null || true
	@echo "[validate] Cleanup done."

# ── Fresh instance bootstrap ───────────────────────────────────────────────────
# Run once after `terraform apply` on a brand-new instance, before the first
# GitHub release. Requires DOMAIN_NAME and CERTBOT_EMAIL in ~/.woodpecker-prod-env.

instance-bootstrap:
	@$(SCRIPTS_DIR)/instance-bootstrap.sh $(EC2_HOST) $(DOMAIN_NAME) $(CERTBOT_EMAIL) $(DEPLOY_DIR)/nginx/https.conf

# ── Operator ───────────────────────────────────────────────────────────────────

whitelist-add:
	ssh -t ubuntu@$(EC2_HOST) "cd /opt/woodpecker && docker compose -f docker-compose.yml -f docker-compose-prod.yml exec backend flask whitelist-add --username $(LICHESS_USERNAME)"


.PHONY: up-local-prod-db \
        db-tunnel-start db-tunnel-stop db-shell db-shell-ec2 db-query db-explain db-table-sizes db-index-stats \
        _confirm-prod-mutation \
        prod-lichess-tactics-validate prod-lichess-tactics-import \
        prod-lichess-tactics-themes-import prod-openings-import \
        prod-scraped-positional-import prod-decoy-import prod-migrate \
        db-backup-validate-latest db-backup-validate db-backup-validate-clean \
        whitelist-add \
        db-backup-now instance-bootstrap
