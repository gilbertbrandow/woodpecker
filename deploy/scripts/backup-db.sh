#!/usr/bin/env bash
set -euo pipefail

set -a
# shellcheck source=/dev/null
source /opt/woodpecker/.env
set +a

TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
YEAR=$(date -u +"%Y")
MONTH=$(date -u +"%m")
BACKUP_FILE="/tmp/woodpecker_${TIMESTAMP}.sql.gz"
S3_KEY="${YEAR}/${MONTH}/woodpecker_${TIMESTAMP}.sql.gz"

echo "[backup] Starting pg_dump at ${TIMESTAMP}"

cd /opt/woodpecker

docker compose \
  -f docker-compose.yml \
  -f docker-compose-prod.yml \
  exec -T db \
  pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" \
  | gzip > "${BACKUP_FILE}"

echo "[backup] Upload to s3://${BACKUP_BUCKET}/${S3_KEY}"
aws s3 cp "${BACKUP_FILE}" "s3://${BACKUP_BUCKET}/${S3_KEY}" --region eu-west-1

echo "[backup] Removing temp file"
rm -f "${BACKUP_FILE}"

echo "[backup] Verifying upload"
"$(dirname "${BASH_SOURCE[0]}")/verify-backup-upload.sh" "${S3_KEY}"

echo "[backup] Done"
