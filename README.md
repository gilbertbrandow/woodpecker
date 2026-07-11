# Woodpecker Chess Trainer

Build a custom puzzle set from tactics, positional puzzles, and decoys. Create a Schedule and compete with others training the same Woodpecker cycles.

![Solving a puzzle in Woodpecker](https://github.com/user-attachments/assets/e5dd4e7b-b8a0-4fed-bf6e-ed3b0a659844)

## Insights & stay on track

Get detailed insights into your accuracy and solve times across every Run and see how they develop cycle over cycle. Clear pointers tell you where you stand in your Schedule — whether to rest, push on, or pick up where you left off. See how your numbers stack up against others training the same cycles on the leaderboard.

![Dashboard and leaderboard](https://github.com/user-attachments/assets/2b883ecf-2f8d-46ab-a085-d97f22b26799)

## Build your own Subsets & Schedules

Compose a puzzle set from Lichess Tactics, Scraped Positional puzzles, and Decoys — filtering by rating, difficulty, or theme. Then configure a Schedule: how many Runs, a time target per puzzle, and the break between Runs. Share your Schedule and anyone can train the same regimen.

![Building a Subset and Schedule](https://github.com/user-attachments/assets/70a653bc-ea7d-412d-a111-521ba887ffc1)

## Local development

### Prerequisites

| Tool | Required for | Install |
| --- | --- | --- |
| Docker + Docker Compose | Running the app locally; Docker-based tests | [docs.docker.com](https://docs.docker.com/get-docker/) |
| nvm | Native frontend setup/tests (`make test-frontend`, `make -C frontend setup/test`) | `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh \| bash` |
| Python 3.12 | Native backend setup/tests (`make -C backend setup/test`) | [python.org](https://www.python.org/downloads/) or system package manager |

### Getting started

```bash
cp .env.example .env
make up-build
make migrate-upgrade
make seed-dev
```

Open [http://localhost:5173](http://localhost:5173) and sign in with your Lichess account.

On subsequent starts, `make up` is enough (no rebuild needed).

`make seed-dev` imports openings, Lichess tactics (themes + puzzles), and scraped positional puzzles, each bounded by `SEED_DEV_LIMIT` (default: 10 000). Override with `make seed-dev SEED_DEV_LIMIT=1000`.

### Windows

Windows development is supported through WSL2.

Recommended setup:

1. Install WSL2 with Ubuntu.
2. Install Docker Desktop.
3. Enable Docker Desktop integration for the Ubuntu WSL distro.
4. Clone this repository inside the WSL filesystem, not under `C:\` or `/mnt/c/...`.
5. Run the normal local development commands from the WSL terminal.

## Testing

```bash
make lint              # ruff + mypy + tsc
make test              # unit tests in Docker
make test-integration  # integration tests in Docker (isolated DB, auto teardown)
make test-all          # full suite
```

## Importing puzzle data

Puzzle data is managed by the standalone pipeline package. See [pipeline/README.md](pipeline/README.md) for full instructions.

For a full local import, run:

```bash
make -C pipeline import-openings
make -C pipeline import-lichess-tactics
make -C pipeline import-scraped-positional
```

Each command downloads its source data automatically on first run. Run in the order shown — openings must precede tactics.

## Deployment

See [DEPLOYMENT.md](deploy/DEPLOYMENT.md) for release and deployment instructions.

Production/operator helper commands live in `deploy/Makefile` and can be run from the repo root with:

```bash
make -C deploy <target>
```
