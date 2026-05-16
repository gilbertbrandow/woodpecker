#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="$HOME/.woodpecker-prod-env"
VALIDATE_CONTAINER="woodpecker-validate-db"
VALIDATE_VOLUME="woodpecker-validate-db-data"
VALIDATE_PORT="5434"
VALIDATE_USER="woodpecker"
VALIDATE_PASSWORD="woodpecker"
VALIDATE_DB="woodpecker"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found." >&2
  echo "Create it with BACKUP_BUCKET and AWS_REGION, then chmod 600 it." >&2
  exit 1
fi
# shellcheck source=/dev/null
source "$ENV_FILE"
: "${BACKUP_BUCKET:?BACKUP_BUCKET must be set in $ENV_FILE}"
AWS_REGION="${AWS_REGION:-eu-west-1}"

echo "[validate] Checking AWS credentials..."
aws sts get-caller-identity --region "$AWS_REGION" > /dev/null

if [[ -n "${S3_KEY:-}" ]]; then
  echo "[validate] Using specified key: $S3_KEY"
else
  echo "[validate] Finding latest backup in s3://${BACKUP_BUCKET}/"
  S3_KEY=$(aws s3 ls "s3://${BACKUP_BUCKET}/" --recursive --region "$AWS_REGION" \
    | grep 'woodpecker_.*\.sql\.gz$' \
    | sort \
    | tail -1 \
    | awk '{print $4}')
  if [[ -z "$S3_KEY" ]]; then
    echo "Error: no backups found in s3://${BACKUP_BUCKET}/" >&2
    exit 1
  fi
  echo "[validate] Latest backup: $S3_KEY"
fi

DUMP_FILE=$(mktemp /tmp/woodpecker-validate-XXXXXX.sql.gz)
trap 'rm -f "$DUMP_FILE"' EXIT

echo "[validate] Downloading s3://${BACKUP_BUCKET}/${S3_KEY}"
aws s3 cp "s3://${BACKUP_BUCKET}/${S3_KEY}" "$DUMP_FILE" --region "$AWS_REGION"

echo "[validate] Testing gzip integrity"
gunzip -t "$DUMP_FILE"

echo "[validate] Starting isolated Postgres container (${VALIDATE_CONTAINER} on port ${VALIDATE_PORT})..."
docker rm -f "$VALIDATE_CONTAINER" 2>/dev/null || true
docker run -d \
  --name "$VALIDATE_CONTAINER" \
  -e POSTGRES_USER="$VALIDATE_USER" \
  -e POSTGRES_PASSWORD="$VALIDATE_PASSWORD" \
  -e POSTGRES_DB="$VALIDATE_DB" \
  -p "127.0.0.1:${VALIDATE_PORT}:5432" \
  -v "${VALIDATE_VOLUME}:/var/lib/postgresql/data" \
  postgres:16

echo "[validate] Waiting for Postgres to be ready..."
for i in $(seq 1 30); do
  if docker exec "$VALIDATE_CONTAINER" pg_isready -U "$VALIDATE_USER" > /dev/null 2>&1; then
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "Error: Postgres did not become ready in 30 seconds." >&2
    exit 1
  fi
  sleep 1
done

echo "[validate] Restoring dump..."
gunzip -c "$DUMP_FILE" | docker exec -i "$VALIDATE_CONTAINER" \
  psql -U "$VALIDATE_USER" -d "$VALIDATE_DB" > /dev/null

echo ""
echo "[validate] Restore complete. Backup is valid."
echo ""
echo "  Connect directly:"
echo "    PGPASSWORD=${VALIDATE_PASSWORD} psql -h localhost -p ${VALIDATE_PORT} -U ${VALIDATE_USER} ${VALIDATE_DB}"
echo ""
echo "  Run the Flask backend against the restored DB:"
echo "    cd backend && DATABASE_URL=postgresql://${VALIDATE_USER}:${VALIDATE_PASSWORD}@localhost:${VALIDATE_PORT}/${VALIDATE_DB} flask run"
echo ""
echo "  Clean up when done:"
echo "    make -C deploy db-backup-validate-clean"
