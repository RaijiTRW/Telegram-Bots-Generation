#!/usr/bin/env bash

set -Eeuo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: cbtooll-deploy.sh <release-id>"
  exit 1
fi

RELEASE_ID="$1"
APP_NAME="cbtooll"
BLUE_DIR="/var/www/cbtooll"
GREEN_DIR="/var/www/cbtooll-green"
SHARED_DIR="/var/www/cbtooll-shared"
UPLOADS_DIR="$SHARED_DIR/uploads"
UPLOAD_DIR="$UPLOADS_DIR/$RELEASE_ID"
ACTIVE_FILE="$SHARED_DIR/active-color"
UPSTREAM_FILE="/etc/nginx/snippets/cbtooll-upstream.conf"
LIVE_RELEASE_LINK="$SHARED_DIR/live-release"

log() {
  printf '[deploy] %s\n' "$*"
}

ensure_dir() {
  mkdir -p "$1"
}

if [[ ! -d "$UPLOAD_DIR" ]]; then
  echo "Upload directory not found: $UPLOAD_DIR"
  exit 1
fi

ensure_dir "$SHARED_DIR"
ensure_dir "$UPLOADS_DIR"
ensure_dir "$GREEN_DIR"

if [[ ! -f "$SHARED_DIR/.env.local" ]]; then
  echo "Missing shared env file: $SHARED_DIR/.env.local"
  exit 1
fi

ACTIVE_COLOR="blue"
if [[ -f "$ACTIVE_FILE" ]]; then
  ACTIVE_COLOR="$(tr -d '[:space:]' < "$ACTIVE_FILE")"
fi

if [[ "$ACTIVE_COLOR" == "green" ]]; then
  TARGET_COLOR="blue"
  TARGET_DIR="$BLUE_DIR"
  TARGET_PORT="3000"
  TARGET_SERVICE="cbtooll-blue.service"
  PREVIOUS_SERVICE="cbtooll-green.service"
else
  TARGET_COLOR="green"
  TARGET_DIR="$GREEN_DIR"
  TARGET_PORT="3001"
  TARGET_SERVICE="cbtooll-green.service"
  PREVIOUS_SERVICE="cbtooll-blue.service"
fi

log "Active color: $ACTIVE_COLOR"
log "Deploying release $RELEASE_ID to $TARGET_COLOR ($TARGET_DIR)"

ensure_dir "$TARGET_DIR"
rsync -az --delete --exclude '.git' --exclude '.github' --exclude 'node_modules' --exclude '.next' "$UPLOAD_DIR"/ "$TARGET_DIR"/
cp "$SHARED_DIR/.env.local" "$TARGET_DIR/.env.local"

cd "$TARGET_DIR"
log "Installing dependencies"
npm ci

log "Building release"
npm run build

log "Restarting $TARGET_SERVICE"
sudo systemctl restart "$TARGET_SERVICE"

log "Waiting for health check on port $TARGET_PORT"
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:$TARGET_PORT/ru" >/dev/null 2>&1; then
    HEALTHY="1"
    break
  fi
  sleep 1
done

if [[ "${HEALTHY:-0}" != "1" ]]; then
  echo "Health check failed for $TARGET_SERVICE on port $TARGET_PORT"
  sudo journalctl -u "$TARGET_SERVICE" -n 120 --no-pager || true
  exit 1
fi

log "Switching nginx upstream to $TARGET_COLOR"
printf 'proxy_pass http://127.0.0.1:%s;\n' "$TARGET_PORT" | sudo tee "$UPSTREAM_FILE" >/dev/null
sudo nginx -t
sudo systemctl reload nginx

printf '%s\n' "$TARGET_COLOR" | sudo tee "$ACTIVE_FILE" >/dev/null
ln -sfn "$TARGET_DIR" "$LIVE_RELEASE_LINK"

if sudo systemctl is-active --quiet "$PREVIOUS_SERVICE"; then
  log "Stopping previous service $PREVIOUS_SERVICE"
  sudo systemctl stop "$PREVIOUS_SERVICE"
fi

if sudo systemctl list-unit-files | grep -q '^telegram-monitor-bot.service'; then
  log "Restarting telegram-monitor-bot.service"
  sudo systemctl restart telegram-monitor-bot.service || true
fi

log "Cleaning upload dir"
rm -rf "$UPLOAD_DIR"

log "Release $RELEASE_ID is live on $TARGET_COLOR"
