# woodpecker

See [DEPLOYMENT.md](deploy/DEPLOYMENT.md) for release and deployment instructions.

## Local development

**Prerequisites:** Docker + Docker Compose

```bash
cp .env.example .env
make up-build
make migrate-upgrade
```

Open **[http://localhost:5173](http://localhost:5173)** and sign in with your Lichess account.

On subsequent starts, `make up` is enough (no rebuild needed).

## Importing puzzles

Download [lichess_db_puzzle.csv.zst](https://database.lichess.org/lichess_db_puzzle.csv.zst), then:

```bash
make puzzle-copy file=/path/to/lichess_db_puzzle.csv.zst
make puzzle-import
make openings-import
```
