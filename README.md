# woodpecker

## Local development prerequisites

| Tool | Required for | Install |
| --- | --- | --- |
| Docker + Docker Compose | Running the app, backend tests | [docs.docker.com](https://docs.docker.com/get-docker/) |
| nvm | Running frontend tests (`make test-frontend`) | `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh \| bash` |

`make test-frontend` sources nvm automatically and installs the Node version specified in `frontend/.nvmrc` (Node 26). nvm itself must be installed on the machine first.

## Local development

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
