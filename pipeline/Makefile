.PHONY: shared-openings-ensure-data shared-openings-import \
        lichess-tactics-themes-import lichess-tactics-import lichess-tactics-validate

shared-openings-ensure-data:
	$(MAKE) -C shared ensure-data

shared-openings-import:
	DATABASE_URL=$(DATABASE_URL) $(MAKE) -C shared import

lichess-tactics-themes-import:
	DATABASE_URL=$(DATABASE_URL) $(MAKE) -C sources/lichess_tactics themes-import

lichess-tactics-import:
	DATABASE_URL=$(DATABASE_URL) FILE=$(FILE) $(MAKE) -C sources/lichess_tactics import-tactics

lichess-tactics-validate:
	DATABASE_URL=$(DATABASE_URL) $(MAKE) -C sources/lichess_tactics validate-links
