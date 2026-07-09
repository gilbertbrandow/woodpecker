# Deployment

## AWS Costs

Monthly AWS costs reported by the `aws-cost-report` workflow. Updated automatically on the 3rd of each month via a pull request — costs are grouped by service and denominated in USD (AWS billing currency). The **SEK paid** column is filled in manually from the card charge.

| Month | Total (USD) | EC2 | Route 53 | S3 | Registrar | Tax | Other | SEK paid | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 2026-04 | $24.00 | $2.29 | $1.01 | $0.10 | $15.00 | $4.80 | $0.81 | 225.9 | Registrar is one-off cost for domain, the rest is lower because not full month active |
| 2026-05 | $20.71 | $11.12 | $1.03 | — | — | $4.14 | $4.41 | 196.61 | Other is mainly Elastic IP (VPC) |
| 2026-06 | $20.21 | $10.85 | $1.01 | $0.03 | — | $4.04 | $4.28 | 200.75 | |

## Infrastructure

Single EC2 t3.micro in eu-west-1 behind an Elastic IP. Chosen for simplicity and cost (~$10/month).

```text
woodpeckerchess.com → 54.216.71.166 (Elastic IP) → EC2 t3.micro (Ubuntu 24.04, 30 GB gp3 root + 10 GB gp3 pgdata)
```

All AWS resources are in `deploy/terraform/`. State is local (`terraform.tfstate` — gitignored). To change infra: edit `.tf` files, then `cd deploy/terraform && terraform apply`.

**Do not resize the instance via Terraform** — it would destroy and recreate it. Use the AWS console instead: stop → Actions → Change instance type → start.

Route 53 hosts `woodpeckerchess.com` (A record → EIP) and `www` (CNAME → apex).

### Scaling path

The t3.micro handles the current load comfortably. When it no longer does, signals and actions:

| Signal | Action |
| --- | --- |
| `CPUCreditBalance` CloudWatch alarm fires | Stop EC2 → AWS console: change type to t3.small → Start |
| Backend OOM / memory pressure | Same resize; t3.small = 2 GB RAM |
| P95 API latency > 2 s at low concurrency | Check Sentry traces for slow queries first; resize if DB-bound |

After resizing to t3.small, increase Gunicorn from 1 to 2 workers in `docker-compose-prod.yml`. This doubles concurrent request capacity within the same instance.

**Do not resize via Terraform.** Always use the AWS console: stop → Actions → Change instance type → start. No data loss, ~5 min downtime.

## Services

Four long-running Docker containers managed by Docker Compose at `/opt/woodpecker`, plus one ephemeral backup container launched by systemd:

| Container | Role |
| --------- | ---- |
| nginx:1.27 | TLS termination, reverse proxy (ports 80 + 443) |
| frontend | nginx serving static React build |
| backend | Gunicorn · Flask · 1 worker · 4 threads |
| db | Postgres 16 · bind-mounted from `/mnt/woodpecker-data/pgdata` (dedicated EBS volume) |
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

## pgdata EBS volume

Postgres data lives on a **dedicated 10 GB gp3 EBS volume** (`woodpecker-pgdata`) mounted at `/mnt/woodpecker-data` on the host. The DB container uses it via a bind mount (`/mnt/woodpecker-data/pgdata:/var/lib/postgresql/data`). This volume is managed separately from the EC2 root volume — it has `prevent_destroy = true` in Terraform and `delete_on_termination = false` on the root volume — so accidental instance termination cannot destroy the database.

### One-time migration (run once after `terraform apply` attaches the volume)

```bash
cd deploy/terraform && terraform apply   # creates + attaches the EBS volume
make -C deploy pgdata-migrate            # formats, mounts, copies pgdata, restarts services
```

`pgdata-migrate` stops the DB briefly (~30 s), copies data from the old Docker named volume to the EBS mount, then restarts everything with the new bind-mount config. The named volume (`woodpecker_pgdata`) is left in place as a fallback until you confirm the site is healthy.

### Fresh instance setup (disaster recovery)

On a brand-new EC2 instance the EBS volume is already formatted (from the prior instance). After attaching it via `terraform apply`, mount it before starting Docker:

```bash
sudo mkdir -p /mnt/woodpecker-data
UUID=$(sudo blkid -s UUID -o value /dev/nvme1n1)
echo "UUID=$UUID /mnt/woodpecker-data ext4 defaults,nofail 0 2" | sudo tee -a /etc/fstab
sudo mount -a
```

Then proceed with the normal certbot + nginx config setup before running the deploy.

## Monitoring

### Sentry (application layer)

Errors and performance traces are sent to [woodpecker-n0.sentry.io](https://woodpecker-n0.sentry.io). The backend uses `FlaskIntegration` (request/response lifecycle) and `SqlalchemyIntegration` (every DB query within a sampled request). Tracing is set to 10% sampling (`traces_sample_rate=0.1`) — sufficient to catch slow endpoints while staying within Sentry's free-tier limit of 10 K transactions/month.

**What to look at in Sentry → Performance:**
- P75/P95 per endpoint — `GET /leaderboard/weekly` is the most complex query and will surface first under load
- DB query spans — each trace shows individual SQL statements with timing; slow scans appear here before they become user-visible

Check current transaction usage at `woodpecker-n0.sentry.io/settings/billing/`. If usage approaches 10 K/month, raise the sample rate threshold or upgrade to the Team plan (~$26/month for 100 K transactions).

### CloudWatch (infrastructure layer)

The t3.micro has a burst CPU credit balance. When credits run out the CPU is hard-capped at 10% — requests slow down silently with no error. A CloudWatch alarm fires when `CPUCreditBalance < 20` for two consecutive 5-minute periods, giving roughly 10 minutes to act before throttling becomes severe.

The alarm and SNS email subscription are managed by Terraform (`deploy/terraform/main.tf`). To enable:

1. Set `alert_email` in `deploy/terraform/terraform.tfvars`
2. Run `cd deploy/terraform && terraform apply`
3. Confirm the subscription email AWS sends to that address — alerts are inactive until confirmed

To check credit status manually: AWS Console → EC2 → select instance → Monitoring tab → **CPUCreditBalance**.

### Disk

Each deploy automatically prunes old Docker images after migrations succeed (`docker image prune -af` in `deploy.yml`). This keeps the 30 GB volume healthy by removing images from prior releases that are no longer running.

To check disk usage at any time:

```bash
ssh ubuntu@54.216.71.166 "df -h && docker system df"
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
