#!/usr/bin/env bash
set -euo pipefail

S3_KEY="${1:?Usage: verify-backup-upload.sh <S3_KEY>}"

: "${BACKUP_BUCKET:?BACKUP_BUCKET must be set}"

VERIFY_FILE=$(mktemp /tmp/woodpecker-verify-XXXXXX.sql.gz)
trap 'rm -f "$VERIFY_FILE"' EXIT

echo "[verify] Downloading s3://${BACKUP_BUCKET}/${S3_KEY}"
aws s3 cp "s3://${BACKUP_BUCKET}/${S3_KEY}" "$VERIFY_FILE" --region eu-west-1

echo "[verify] Testing gzip integrity"
gunzip -t "$VERIFY_FILE"

echo "[verify] OK — backup is readable"
