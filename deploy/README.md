# Deployment

## AWS Costs

Monthly AWS costs reported by the `aws-cost-report` workflow. Updated automatically on the 3rd of each month via a pull request — costs are grouped by service and denominated in USD (AWS billing currency). The **SEK paid** column is filled in manually from the card charge.

| Month | Total (USD) | EC2 | Route 53 | S3 | Registrar | Tax | Other | SEK paid | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 2026-04 | $24.00 | $2.29 | $1.01 | $0.10 | $15.00 | $4.80 | $0.81 | 225.9 | Registrar is one-off cost for domain, the rest is lower because not full month active |

## Infrastructure

Single EC2 t3.micro in eu-west-1 behind an Elastic IP. Chosen for simplicity and cost (~$10/month); scaling path is stop → resize → start, no data loss.

```text
woodpeckerchess.com → 54.216.71.166 (Elastic IP) → EC2 t3.micro (Ubuntu 24.04, 30 GB gp3)
```

All AWS resources are in `deploy/terraform/`. State is local (`terraform.tfstate` — gitignored). To change infra: edit `.tf` files, then `cd deploy/terraform && terraform apply`.

**Do not resize the instance via Terraform** — it would destroy and recreate it. Use the AWS console instead: stop → Actions → Change instance type → start.

Route 53 hosts `woodpeckerchess.com` (A record → EIP) and `www` (CNAME → apex).

## Services

Four long-running Docker containers managed by Docker Compose at `/opt/woodpecker`, plus one ephemeral backup container launched by systemd:

| Container | Role |
| --------- | ---- |
| nginx:1.27 | TLS termination, reverse proxy (ports 80 + 443) |
| frontend | nginx serving static React build |
| backend | Gunicorn · Flask · 1 worker · 4 threads |
| db | Postgres 16 · named volume `pgdata` |
| backup | Ephemeral — runs daily at 02:00 UTC via systemd, exits when done |

`/api/*` → backend:8000. Everything else → frontend:80. Postgres is internal only.

1 Gunicorn worker (not 2) to fit inside 1 GB RAM. 4 threads give concurrency without forking.

## How deploys work

1. PR → CI runs lint, typecheck, tests. Merge blocked until all pass.
2. Maintainer publishes a GitHub Release → `deploy.yml` triggers.
3. Builds `backend`, `frontend`, and `backup` Docker images, tags `<version>` + `latest`, pushes to GHCR.
4. SSHes into EC2, pulls images, restarts containers, waits for backend health, runs `flask db upgrade`.

Migrations run on every deploy via Alembic. Idempotent.

## Releasing

1. Go to **GitHub → Releases → Draft a new release**.
2. Click **"Choose a tag"** and type a new semver tag (e.g. `v1.2.3`), targeting `main`.
3. Click **"Generate release notes"** — PRs are automatically categorised by label.
4. Review the notes and click **Publish release**.

**Tag format:** `vMAJOR.MINOR.PATCH` — follow [semver](https://semver.org). Increment PATCH for fixes, MINOR for new features, MAJOR for breaking changes.

The nginx config on the server (`/opt/woodpecker/deploy/nginx/default.conf`) is **not touched by deploys** — it lives on the host and is managed manually to protect the SSL config from being overwritten.

## GitHub secrets

| Secret | Value |
| ------ | ----- |
| `EC2_HOST` | `54.216.71.166` |
| `EC2_SSH_KEY` | Private key for `woodpecker-key` |
| `GHCR_TOKEN` | GitHub PAT with `write:packages` |
| `BACKUP_BUCKET` | Output of `cd deploy/terraform && terraform output -raw backup_bucket_name` |

Application secrets live in `/opt/woodpecker/.env` on the server only.

## TLS

Cert from Let's Encrypt via `certbot --webroot`. Stored at `/etc/letsencrypt/live/woodpeckerchess.com/`, mounted read-only into the nginx container. Renewed automatically by `certbot.timer` (systemd, twice daily). A deploy hook at `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh` reloads the nginx container after renewal.

To update the nginx config:

```bash
sed 's/<domain>/woodpeckerchess.com/g' deploy/nginx/https.conf > /tmp/nginx-ssl.conf
scp /tmp/nginx-ssl.conf ubuntu@54.216.71.166:/opt/woodpecker/deploy/nginx/default.conf
ssh ubuntu@54.216.71.166 "cd /opt/woodpecker && docker compose -f docker-compose.yml -f docker-compose-prod.yml restart nginx"
```

## Backups

A systemd timer (`woodpecker-backup.timer`) fires daily at 02:00 UTC. It runs `docker compose run --rm backup` as the `ubuntu` user, which starts the `woodpecker-backup` container. The container connects to `db:5432` over the Docker network, streams `pg_dump` through gzip, uploads to S3 under `YYYY/MM/woodpecker_TIMESTAMP.sql.gz`, and re-downloads the file to verify gzip integrity. Backups are kept for 30 days via an S3 lifecycle rule.

The EC2 instance has an IAM instance profile that grants write access to the backup bucket — no credentials in `.env` are needed.

The backup container reports check-ins to Sentry Cron Monitors (`woodpecker-backup` monitor in the `woodpecker-backend` project). A missed or failed check-in triggers a Sentry alert. The monitor is created automatically on first successful run.

### Files on the server

| Path | Purpose |
| ---- | ------- |
| `/etc/systemd/system/woodpecker-backup.service` | oneshot service unit |
| `/etc/systemd/system/woodpecker-backup.timer` | daily timer unit |

### Checking backup status

```bash
ssh ubuntu@54.216.71.166

# Is the timer active and when does it next fire?
systemctl list-timers woodpecker-backup.timer

# Logs from the last run
journalctl -u woodpecker-backup.service -n 50

# List files in S3
source /opt/woodpecker/.env
aws s3 ls s3://${BACKUP_BUCKET}/ --recursive
```

### Running a backup manually

```bash
ssh ubuntu@54.216.71.166
sudo systemctl start woodpecker-backup.service
journalctl -u woodpecker-backup.service -f
```

### Validating a backup locally

Run this from your local machine (requires AWS CLI access to the backup bucket and Docker).

Add `BACKUP_BUCKET` and `AWS_REGION` to `~/.woodpecker-prod-env` if not already present:

```bash
echo 'BACKUP_BUCKET=your-bucket-name' >> ~/.woodpecker-prod-env
echo 'AWS_REGION=eu-west-1' >> ~/.woodpecker-prod-env
```

Then validate the latest backup:

```bash
make -C deploy db-backup-validate-latest
```

Or validate a specific backup key:

```bash
make -C deploy db-backup-validate S3_KEY=YYYY/MM/woodpecker_TIMESTAMP.sql.gz
```

The script will download the backup, verify the gzip is readable, and restore it into an isolated `postgres:16` container on `localhost:5434`. It prints connection instructions on success. The container persists after validation so you can inspect the data manually. To clean up:

```bash
make -C deploy db-backup-validate-clean
```

This does **not** touch the production database or your normal local dev database.

### Restoring from backup (production disaster recovery)

```bash
ssh ubuntu@54.216.71.166

# Find the backup to restore
source /opt/woodpecker/.env
aws s3 ls s3://${BACKUP_BUCKET}/ --recursive

# Download and restore (stop backend first for a clean restore)
cd /opt/woodpecker
docker compose -f docker-compose.yml -f docker-compose-prod.yml stop backend
aws s3 cp s3://${BACKUP_BUCKET}/YYYY/MM/woodpecker_TIMESTAMP.sql.gz /tmp/restore.sql.gz
gunzip -c /tmp/restore.sql.gz | docker compose \
  -f docker-compose.yml -f docker-compose-prod.yml \
  exec -T db psql -U woodpecker woodpecker
docker compose -f docker-compose.yml -f docker-compose-prod.yml start backend
rm /tmp/restore.sql.gz
```

## Database access

Operator credentials live in `~/.woodpecker-prod-env` outside the repo (chmod 600, never committed). Create it manually:

```bash
cat > ~/.woodpecker-prod-env << 'EOF'
EC2_HOST=your-ec2-host
PROD_DB_PASSWORD=your-db-password
BACKUP_BUCKET=your-backup-bucket-name
AWS_REGION=eu-west-1
EOF
chmod 600 ~/.woodpecker-prod-env
```

```bash
# Open a background tunnel (localhost:5433 → production DB)
make -C deploy db-tunnel-start

# Interactive psql
make -C deploy db-shell

# Single query (useful for scripting and LLM-driven inspection)
make -C deploy db-query SQL="SELECT count(*) FROM training_items"

# Close the tunnel and unexpose the DB port on EC2
make -C deploy db-tunnel-stop

# Direct psql shell on EC2 without a local tunnel
make -C deploy db-shell-ec2
```

GUI tools (Beekeeper, TablePlus, etc.): run `db-tunnel-start`, connect to `localhost:5433` with user `woodpecker` and the password from `~/.woodpecker-prod-env`.

## Rollback

```bash
ssh ubuntu@54.216.71.166
cd /opt/woodpecker
IMAGE_TAG=v1.2.2 docker compose -f docker-compose.yml -f docker-compose-prod.yml up -d
docker compose -f docker-compose.yml -f docker-compose-prod.yml exec -T backend flask --app app db downgrade -1
```

Version tags are in the GHCR package history and the GitHub Releases page.
