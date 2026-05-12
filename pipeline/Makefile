shared-openings-import:
	DATABASE_URL=$(DATABASE_URL) python cli.py shared openings import

lichess-tactics-themes-import:
	DATABASE_URL=$(DATABASE_URL) python cli.py lichess-tactics themes import

lichess-tactics-import:
	DATABASE_URL=$(DATABASE_URL) python cli.py lichess-tactics tactics import --file $(FILE)

lichess-tactics-validate:
	DATABASE_URL=$(DATABASE_URL) python cli.py lichess-tactics validate-links
