# woodpecker

## Local development prerequisites

| Tool | Required for | Install |
| --- | --- | --- |
| Docker + Docker Compose | Running the app, running tests | [docs.docker.com](https://docs.docker.com/get-docker/) |
| nvm | `make lint` and `make setup` (frontend) | `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh \| bash` |

## Local development

```bash
cp .env.example .env
make up-build
make migrate-upgrade
make seed-dev
```

Open [http://localhost:5173](http://localhost:5173) and sign in with your Lichess account.

On subsequent starts, `make up` is enough (no rebuild needed).

`make seed-dev` imports shared opening data, Lichess tactic themes, and a bounded set of Lichess tactics for local development. The default tactic import limit is 1000. Override it with:

```bash
make seed-dev SEED_DEV_LIMIT=5000
```

## Testing

```bash
make lint              # ruff + mypy + tsc
make test              # unit tests in Docker
make test-integration  # integration tests in Docker (isolated DB, auto teardown)
make test-all          # full suite
```

## Importing puzzle data

Puzzle data is managed by the standalone pipeline package. See [pipeline/data/README.md](pipeline/data/README.md) for full instructions.

For a full local import, run:

```bash
make -C pipeline shared-openings-import
make -C pipeline lichess-tactics-themes-import
make -C pipeline lichess-tactics-import
make -C pipeline lichess-tactics-validate
```

Each step downloads its source data automatically on first run.

## Windows development

Windows development is supported through WSL2.

Recommended setup:

1. Install WSL2 with Ubuntu.
2. Install Docker Desktop.
3. Enable Docker Desktop integration for the Ubuntu WSL distro.
4. Clone this repository inside the WSL filesystem, not under `C:\` or `/mnt/c/...`.
5. Run the normal local development commands from the WSL terminal.

## Deployment

See [DEPLOYMENT.md](deploy/DEPLOYMENT.md) for release and deployment instructions.

Production/operator helper commands live in `deploy/Makefile` and can be run from the repo root with:

```bash
make -C deploy <target>
```
