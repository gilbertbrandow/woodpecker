#!/bin/bash
# One-time migration: moves pgdata from Docker named volume to the dedicated EBS volume.
# Run via: make -C deploy pgdata-migrate
# Prerequisites: terraform apply has been run and the pgdata EBS volume is attached.
set -euo pipefail

echo "==> Locating pgdata EBS device..."
PGDATA_DEV=$(lsblk -dpn -o NAME,TYPE | awk '$2=="disk" && $1!="/dev/nvme0n1" {print $1}' | head -1)
if [ -z "$PGDATA_DEV" ]; then
  echo "ERROR: No secondary EBS device found. Run 'terraform apply' first." >&2
  exit 1
fi
echo "    Device: $PGDATA_DEV"

echo "==> Formatting (skipped if already formatted)..."
if ! sudo blkid "$PGDATA_DEV" &>/dev/null; then
  sudo mkfs.ext4 "$PGDATA_DEV"
  echo "    Formatted ext4"
else
  echo "    Already formatted — skipping"
fi

echo "==> Mounting at /mnt/woodpecker-data..."
sudo mkdir -p /mnt/woodpecker-data
DEV_UUID=$(sudo blkid -s UUID -o value "$PGDATA_DEV")
if ! grep -q "$DEV_UUID" /etc/fstab; then
  echo "UUID=$DEV_UUID /mnt/woodpecker-data ext4 defaults,nofail 0 2" | sudo tee -a /etc/fstab
fi
sudo mount -a

echo "==> Stopping backend and db containers..."
cd /opt/woodpecker
docker compose -f docker-compose.yml -f docker-compose-prod.yml stop backend db

echo "==> Copying pgdata from named volume to EBS..."
sudo mkdir -p /mnt/woodpecker-data/pgdata
sudo cp -a /var/lib/docker/volumes/woodpecker_pgdata/_data/. /mnt/woodpecker-data/pgdata/
# postgres:16 runs as uid 999 inside the container
sudo chown -R 999:999 /mnt/woodpecker-data/pgdata
echo "    Done"
