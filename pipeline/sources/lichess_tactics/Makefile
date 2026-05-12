.PHONY: themes-ensure-data themes-import import-tactics validate-links

themes-ensure-data:
	cd ../.. && python cli.py lichess-tactics themes ensure-data

themes-import:
	cd ../.. && DATABASE_URL=$(DATABASE_URL) python cli.py lichess-tactics themes import

import-tactics:
	cd ../.. && DATABASE_URL=$(DATABASE_URL) python cli.py lichess-tactics tactics import --file $(FILE)

validate-links:
	cd ../.. && DATABASE_URL=$(DATABASE_URL) python cli.py lichess-tactics validate-links
