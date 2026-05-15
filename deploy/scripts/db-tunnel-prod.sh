#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$HOME/.woodpecker-prod-env"
PID_FILE="$DEPLOY_DIR/.db-tunnel.pid"

load_env() {
    if [[ ! -f "$ENV_FILE" ]]; then
        echo "Error: $ENV_FILE not found. Create it with EC2_HOST and PROD_DB_PASSWORD, then chmod 600 it." >&2
        exit 1
    fi
    # shellcheck source=/dev/null
    source "$ENV_FILE"
    : "${EC2_HOST:?EC2_HOST must be set in deploy/.env.local}"
    : "${PROD_DB_PASSWORD:?PROD_DB_PASSWORD must be set in deploy/.env.local}"
}

start() {
    load_env

    if [[ -f "$PID_FILE" ]]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            echo "Tunnel already running (PID $PID). Run 'make -C deploy db-tunnel-stop' to stop it." >&2
            exit 1
        fi
        rm "$PID_FILE"
    fi

    echo "[PRODUCTION] Exposing DB port on EC2..."
    ssh ubuntu@"$EC2_HOST" \
        "cd /opt/woodpecker && docker compose -f docker-compose.yml -f docker-compose-prod.yml -f deploy/docker-compose-db-tunnel.yml up -d --no-deps db"

    echo "[PRODUCTION] Starting SSH tunnel localhost:5433 → EC2 db..."
    ssh -N -L 5433:localhost:5432 ubuntu@"$EC2_HOST" &
    TUNNEL_PID=$!
    echo "$TUNNEL_PID" > "$PID_FILE"

    echo "[PRODUCTION] Tunnel open (PID $TUNNEL_PID). localhost:5433 → production DB."
    echo "  Stop with: make -C deploy db-tunnel-stop"
}

stop() {
    load_env

    if [[ ! -f "$PID_FILE" ]]; then
        echo "No tunnel PID file found. Is the tunnel running?" >&2
        exit 1
    fi

    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        kill "$PID"
        echo "SSH tunnel (PID $PID) stopped."
    else
        echo "PID $PID not running (stale PID file)."
    fi
    rm "$PID_FILE"

    echo "[PRODUCTION] Unexposing DB port on EC2..."
    ssh ubuntu@"$EC2_HOST" \
        "cd /opt/woodpecker && docker compose -f docker-compose.yml -f docker-compose-prod.yml up -d --no-deps db"

    echo "Tunnel closed."
}

case "${1:-}" in
    start) start ;;
    stop)  stop  ;;
    *) echo "Usage: $0 {start|stop}" >&2; exit 1 ;;
esac
