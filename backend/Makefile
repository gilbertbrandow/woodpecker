setup:
	python3 -m venv .venv
	.venv/bin/pip install --upgrade pip
	.venv/bin/pip install -r requirements.txt

lint:
	.venv/bin/ruff check app/ migrations/
	.venv/bin/mypy app/ migrations/

test:
	.venv/bin/pytest -m "not integration"

test-integration:
	.venv/bin/pytest -m integration

test-all:
	.venv/bin/pytest

dev-session:
	@[ -n "$(USERNAME)" ] || (echo "error: USERNAME is required  Usage: make dev-session USERNAME=<lichess_username>" >&2 && exit 1)
	@set -a && . ../.env && set +a && \
	DATABASE_URL="postgresql://$${POSTGRES_USER:-woodpecker}:$${POSTGRES_PASSWORD:-woodpecker}@localhost:5432/$${POSTGRES_DB:-woodpecker}" \
	.venv/bin/python scripts/dev_session.py $(USERNAME)

migrate:
	.venv/bin/flask db upgrade

.PHONY: setup lint test test-integration test-all dev-session migrate
