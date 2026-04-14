#!/usr/bin/env bash
set -euo pipefail

VPS_HOST="${VPS_HOST:-root@72.60.245.87}"
VPS_PATH="${VPS_PATH:-/var/www/dashboard-matico}"
BRANCH="${BRANCH:-main}"

echo "==> Deploy VPS Docker en ${VPS_HOST}:${VPS_PATH} (branch: ${BRANCH})"

ssh "$VPS_HOST" "bash -lc '
set -euo pipefail
cd \"$VPS_PATH\"
git pull origin \"$BRANCH\"
docker compose down
docker compose up --build -d
docker compose ps
docker compose logs --tail=100
'"

echo "==> Deploy VPS Docker completado."
