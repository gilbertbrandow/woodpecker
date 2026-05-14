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

.PHONY: setup lint test test-integration test-all
