#!/usr/bin/env bash
#
# One-shot provisioning for a fresh Ubuntu 22.04/24.04 box that will run the
# monitoring service. Safe to re-run.
#
#   curl -O .../setup-server.sh && sudo bash setup-server.sh
#
# What it does:
#   - creates a non-root "monitor" user
#   - installs Node.js 22 and the Chromium libraries Playwright needs
#   - adds swap (Chromium on a 1 GB box dies without it)
#   - installs the systemd unit and enables it
#
# It does NOT write .env — do that yourself so credentials never land in a
# script or shell history.

set -euo pipefail

APP_USER="monitor"
APP_DIR="/opt/istudio-monitoring"
NODE_MAJOR="22"

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

log "Updating packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

log "Installing base tools"
apt-get install -y curl ca-certificates gnupg git ufw unzip

log "Installing Node.js ${NODE_MAJOR}"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -c2- | cut -d. -f1)" -lt "${NODE_MAJOR}" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
node -v
npm -v

# Chromium is memory-hungry and a 1 GB instance will OOM mid-run without swap.
# 2 GB of swap is cheap insurance even on a 2 GB box.
log "Configuring 2G swap"
if [[ ! -f /swapfile ]]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
free -h

log "Creating ${APP_USER} user and ${APP_DIR}"
id -u "${APP_USER}" >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash "${APP_USER}"
mkdir -p "${APP_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

log "Installing Playwright's Chromium system dependencies"
# Run as root, NOT as ${APP_USER}. `playwright install-deps` shells out to
# apt-get via sudo; the service account has no password and no sudo rights, so
# running it as that user hangs forever on a "[sudo] password for monitor:"
# prompt. This script is already root, so call it directly.
#
# The dependency list comes from Playwright itself rather than being pinned
# here, because the package names drift with every Ubuntu release.
npx --yes playwright install-deps chromium || {
  echo "playwright install-deps failed; falling back to an explicit package list"
  # Ubuntu 24.04 renamed several of these in the 64-bit time_t transition, so
  # each one falls back to its pre-24.04 name.
  for pkg in libnss3 libnspr4 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
             libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 \
             fonts-liberation fonts-noto-color-emoji; do
    apt-get install -y "$pkg" || true
  done
  for pair in "libasound2t64:libasound2" "libatk1.0-0t64:libatk1.0-0" \
              "libatk-bridge2.0-0t64:libatk-bridge2.0-0" "libcups2t64:libcups2" \
              "libatspi2.0-0t64:libatspi2.0-0"; do
    apt-get install -y "${pair%%:*}" || apt-get install -y "${pair##*:}" || true
  done
}

log "Firewall"
ufw allow OpenSSH
# Status dashboard. Restrict this to your office IP in the cloud security group
# too — the page shows which of your systems are down.
ufw allow 8080/tcp
ufw --force enable
ufw status

log "Installing systemd unit"
if [[ -f "$(dirname "$0")/monitoring.service" ]]; then
  install -m 644 "$(dirname "$0")/monitoring.service" /etc/systemd/system/istudio-monitoring.service
  systemctl daemon-reload
  systemctl enable istudio-monitoring
  echo "Unit installed but NOT started — deploy the code and .env first, then:"
  echo "  sudo systemctl start istudio-monitoring"
else
  echo "monitoring.service not found next to this script; copy it manually."
fi

cat <<EOF

────────────────────────────────────────────────────────────────────
Server is ready. Next:

  1. Copy the project up:
       rsync -av --exclude node_modules --exclude .env \\
         ./monitoring/ ${APP_USER}@<this-server>:${APP_DIR}/

  2. Install and fetch Chromium:
       sudo -u ${APP_USER} bash -lc 'cd ${APP_DIR} && npm ci --omit=dev && npx playwright install chromium'

  3. Write ${APP_DIR}/.env  (copy .env.example, fill in SMTP + ALERT_TO)
       sudo -u ${APP_USER} nano ${APP_DIR}/.env
       sudo chmod 600 ${APP_DIR}/.env

  4. Smoke test before enabling alerts:
       sudo -u ${APP_USER} bash -lc 'cd ${APP_DIR} && node src/runOnce.js --group=light --no-alert'
       sudo -u ${APP_USER} bash -lc 'cd ${APP_DIR} && npm run test:alert'

  5. Start it:
       sudo systemctl start istudio-monitoring
       sudo journalctl -u istudio-monitoring -f
────────────────────────────────────────────────────────────────────
EOF
