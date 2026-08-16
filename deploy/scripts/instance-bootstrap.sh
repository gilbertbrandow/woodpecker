#!/bin/bash
# Bootstrap a fresh EC2 instance after `terraform apply`.
# Idempotent — safe to re-run against an existing instance.
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

echo "==> Hardening instance..."
# All steps are idempotent — safe to re-run if bootstrap is repeated.
ssh ubuntu@"$EC2_HOST" 'bash -s' << 'HARDEN'
set -euo pipefail

# ── Swap (2 GB) ────────────────────────────────────────────────────────────────
# Prevents OOM kills on 1 GB RAM. Without swap, a Postgres memory spike kills the
# process instantly; with swap it degrades gracefully instead.
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  echo "    Swap created (2 GB)"
else
  echo "    Swap already present, skipping"
fi

# ── Docker log rotation ────────────────────────────────────────────────────────
# Container logs are unbounded by default. Cap at 10 MB × 3 files = 30 MB max
# per container so they cannot fill the 15 GB root volume over time.
# Docker daemon restart is safe here — no containers are running at bootstrap time.
echo '{"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"}}' \
  | sudo tee /etc/docker/daemon.json > /dev/null
sudo systemctl restart docker
echo "    Docker log rotation configured"

# ── DHCP keep-alive ────────────────────────────────────────────────────────────
# By default, systemd-networkd tears down the IP immediately if a DHCP renewal
# times out, making the instance externally unreachable. KeepConfiguration=dhcp
# retains the current address and routes while the server is unreachable so a
# transient renewal failure does not take the site down.
sudo mkdir -p /etc/systemd/network/10-netplan-ens5.network.d
sudo tee /etc/systemd/network/10-netplan-ens5.network.d/keep-dhcp.conf > /dev/null << 'DROPIN'
[DHCP]
KeepConfiguration=dhcp
DROPIN
echo "    DHCP keep-alive drop-in written"

# ── Disable zero-value background services ─────────────────────────────────────
# fwupd downloads ~2 MB of firmware metadata every hour and spends ~20 minutes
# processing it. On a t3.micro this saturates the network and CPU enough to cause
# DHCP renewal timeouts. Firmware updates inside an EC2 VM are meaningless — AWS
# manages firmware at the hypervisor level.
sudo systemctl disable --now fwupd-refresh.timer 2>/dev/null && echo "    fwupd-refresh disabled" || echo "    fwupd-refresh already disabled"
# Desktop tools with no server value.
sudo systemctl disable --now motd-news.timer 2>/dev/null || true
sudo systemctl disable --now update-notifier-download.timer update-notifier-motd.timer 2>/dev/null || true
echo "    motd-news and update-notifier disabled"

# ── needrestart: list-only ─────────────────────────────────────────────────────
# After installing packages, needrestart auto-restarts services that link against
# updated libraries. In automatic mode it would restart Docker, taking all
# containers down mid-operation. List-only mode records what needs restarting
# without acting — the restart happens on the next intentional deploy instead.
sudo mkdir -p /etc/needrestart/conf.d
sudo tee /etc/needrestart/conf.d/no-auto-restart.conf > /dev/null << 'CONF'
$nrconf{restart} = 'l';
CONF
echo "    needrestart set to list-only"

# ── Disable unused system daemons ──────────────────────────────────────────────
# multipathd manages redundant physical paths to SAN/NAS storage arrays.
# EC2 EBS presents volumes as single NVMe devices — no multipath exists here.
# Consumes ~26 MB for zero benefit.
sudo systemctl disable --now multipathd 2>/dev/null || true
sudo systemctl mask multipathd multipathd.socket
echo "    multipathd masked"

# fwupd refresh timer is disabled above; stop and mask the daemon and its socket
# so it cannot be restarted by any other trigger. Firmware updates inside a VM
# are meaningless — AWS manages firmware at the hypervisor level. ~14 MB freed.
sudo systemctl stop fwupd 2>/dev/null || true
sudo systemctl mask fwupd fwupd.socket
echo "    fwupd daemon masked"

# amazon-ssm-agent is installed as a snap but cannot authenticate — the IAM role
# on this instance does not grant SSM permissions (ssm:UpdateInstanceInformation).
# SSH key access is the only access method used. Snap consumes ~14 MB resident.
# snapd itself is left in place to avoid apt dependency friction.
sudo snap remove amazon-ssm-agent 2>/dev/null && echo "    amazon-ssm-agent snap removed" || echo "    amazon-ssm-agent already absent"

HARDEN

echo "==> Obtaining TLS certificate..."
ssh ubuntu@"$EC2_HOST" "sudo certbot certonly --standalone \
  -d $DOMAIN_NAME -d www.$DOMAIN_NAME \
  --non-interactive --agree-tos -m $CERTBOT_EMAIL"

echo "==> Pushing nginx config..."
sed "s/<domain>/$DOMAIN_NAME/g" "$NGINX_TEMPLATE" \
  | ssh ubuntu@"$EC2_HOST" "cat > /opt/woodpecker/deploy/nginx/default.conf"

echo ""
echo "Bootstrap complete. Publish a GitHub release to deploy the application."
