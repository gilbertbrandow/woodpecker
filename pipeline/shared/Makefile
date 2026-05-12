.PHONY: ensure-data import

ensure-data:
	cd .. && python cli.py shared openings ensure-data

import:
	cd .. && DATABASE_URL=$(DATABASE_URL) python cli.py shared openings import
