#!/bin/bash
# Bootstrap a fresh EC2 instance after `terraform apply`.
# Mounts the pgdata EBS volume, obtains a TLS certificate, and pushes the nginx config.
# Run via: make -C deploy instance-bootstrap
set -euo pipefail

EC2_HOST="${1:?EC2_HOST not set — add to ~/.woodpecker-prod-env}"
DOMAIN_NAME="${2:?DOMAIN_NAME not set — add to ~/.woodpecker-prod-env}"
CERTBOT_EMAIL="${3:?CERTBOT_EMAIL not set — add to ~/.woodpecker-prod-env}"
NGINX_TEMPLATE="${4:?nginx template path not provided}"

echo "==> Waiting for SSH on $EC2_HOST..."
until ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new ubuntu@"$EC2_HOST" true 2>/dev/null; do
  sleep 5
done

echo "==> Mounting pgdata EBS volume..."
ssh ubuntu@"$EC2_HOST" '
  sudo mkdir -p /mnt/woodpecker-data
  UUID=$(sudo blkid -s UUID -o value /dev/nvme1n1)
  grep -q "$UUID" /etc/fstab || echo "UUID=$UUID /mnt/woodpecker-data ext4 defaults,nofail 0 2" | sudo tee -a /etc/fstab
  sudo mount -a
  mountpoint -q /mnt/woodpecker-data && echo "    Mounted" || { echo "ERROR: mount failed"; exit 1; }
'

echo "==> Obtaining TLS certificate..."
ssh ubuntu@"$EC2_HOST" "sudo certbot certonly --standalone \
  -d $DOMAIN_NAME -d www.$DOMAIN_NAME \
  --non-interactive --agree-tos -m $CERTBOT_EMAIL"

echo "==> Pushing nginx config..."
sed "s/<domain>/$DOMAIN_NAME/g" "$NGINX_TEMPLATE" \
  | ssh ubuntu@"$EC2_HOST" "cat > /opt/woodpecker/deploy/nginx/default.conf"

echo ""
echo "Bootstrap complete. Publish a GitHub release to deploy the application."
