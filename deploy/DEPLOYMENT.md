# Deployment

## Infrastructure

Single EC2 t3.micro in eu-west-1 behind an Elastic IP. Chosen for simplicity and cost (~$10/month); scaling path is stop → resize → start, no data loss.

```text
woodpeckerchess.com → 54.216.71.166 (Elastic IP) → EC2 t3.micro (Ubuntu 24.04, 30 GB gp3)
```

All AWS resources are in `deploy/terraform/`. State is local (`terraform.tfstate` — gitignored). To change infra: edit `.tf` files, then `cd deploy/terraform && terraform apply`.

**Do not resize the instance via Terraform** — it would destroy and recreate it. Use the AWS console instead: stop → Actions → Change instance type → start.

Route 53 hosts `woodpeckerchess.com` (A record → EIP) and `www` (CNAME → apex).

## Services

Four Docker containers managed by Docker Compose at `/opt/woodpecker`:

| Container | Role |
| --------- | ---- |
| nginx:1.27 | TLS termination, reverse proxy (ports 80 + 443) |
| frontend | nginx serving static React build |
| backend | Gunicorn · Flask · 1 worker · 4 threads |
| db | Postgres 16 · named volume `pgdata` |

`/api/*` → backend:8000. Everything else → frontend:80. Postgres is internal only.

1 Gunicorn worker (not 2) to fit inside 1 GB RAM. 4 threads give concurrency without forking.

## How deploys work

1. PR → CI runs lint, typecheck, tests. Merge blocked until all pass.
2. Maintainer publishes a GitHub Release → `deploy.yml` triggers.
3. Builds `backend` and `frontend` Docker images, tags `<version>` + `latest`, pushes to GHCR.
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

A systemd timer (`woodpecker-backup.timer`) fires daily at 02:00 UTC. It runs `/opt/woodpecker/scripts/backup-db.sh` as the `ubuntu` user, which streams `pg_dump` from the `db` container through gzip and uploads to S3 under `YYYY/MM/woodpecker_TIMESTAMP.sql.gz`. Backups are kept for 30 days via an S3 lifecycle rule.

The EC2 instance has an IAM instance profile that grants write access to the backup bucket — no credentials in `.env` are needed.

### Files on the server

| Path | Purpose |
| ---- | ------- |
| `/opt/woodpecker/scripts/backup-db.sh` | Backup script (deployed by CI) |
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

### Restoring from backup

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

```bash
make db-shell-ec2 EC2_HOST=54.216.71.166      # psql shell on server
make db-expose-ec2 EC2_HOST=54.216.71.166      # bind DB to 127.0.0.1:5432 on EC2
make db-tunnel-ec2 EC2_HOST=54.216.71.166      # forward localhost:5433 → EC2 (blocks)
make db-unexpose-ec2 EC2_HOST=54.216.71.166    # remove port binding
```

GUI tools: run `db-expose-ec2` + `db-tunnel-ec2`, connect to `localhost:5433`.

## Rollback

```bash
ssh ubuntu@54.216.71.166
cd /opt/woodpecker
IMAGE_TAG=v1.2.2 docker compose -f docker-compose.yml -f docker-compose-prod.yml up -d
docker compose -f docker-compose.yml -f docker-compose-prod.yml exec -T backend flask --app app db downgrade -1
```

Version tags are in the GHCR package history and the GitHub Releases page.
