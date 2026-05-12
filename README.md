# woodpecker

## Local development

Prerequisites: Docker + Docker Compose

```bash
cp .env.example .env
make up-build
make migrate-upgrade
```

Open [http://localhost:5173](http://localhost:5173) and sign in with your Lichess account.

On subsequent starts, `make up` is enough (no rebuild needed).

## Importing puzzles

Puzzle data is managed by the standalone pipeline package. See [pipeline/data/README.md](pipeline/data/README.md) for full instructions. The short version:

```bash
make -C pipeline shared-openings-import
make -C pipeline lichess-tactics-themes-import
make -C pipeline lichess-tactics-import
make -C pipeline lichess-tactics-validate
```

Each step downloads its source data automatically on first run.

## Deployment

See [DEPLOYMENT.md](deploy/DEPLOYMENT.md) for release and deployment instructions.
