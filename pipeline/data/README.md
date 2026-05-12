# Pipeline data directory

`sources.yml` documents where each source file comes from and its optional checksum.

`raw/` holds downloaded source files (gitignored). Pipeline commands download files here automatically when missing.

`cache/` holds intermediate processed data (gitignored).

Run pipeline commands with `DATABASE_URL` set to download missing files and import data:

```bash
DATABASE_URL=postgresql://... python cli.py shared openings import
DATABASE_URL=postgresql://... python cli.py lichess-tactics themes import
DATABASE_URL=postgresql://... python cli.py lichess-tactics tactics import --file /path/to/lichess_db_puzzle.csv.zst
DATABASE_URL=postgresql://... python cli.py lichess-tactics validate-links
```
