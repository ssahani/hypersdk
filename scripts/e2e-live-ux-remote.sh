#!/usr/bin/env bash
# Run live UX → API wiring verification against a remote Machina host.
#
# Usage:
#   VSPASS=max ./scripts/e2e-live-ux-remote.sh sus 212.8.252.194
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

USER="${1:?usage: $0 USER HOST}"
HOST="${2:?usage: $0 USER HOST}"
PASS="${VSPASS:-${SSHPASS:-}}"

if [[ -z "$PASS" ]]; then
  read -rsp "Password for ${USER}@${HOST}: " PASS
  echo
fi

BASE="https://${HOST}:5092"

echo "══════════════════════════════════════════"
echo "  Live UX wiring verification"
echo "  Target: ${BASE}"
echo "══════════════════════════════════════════"

cd "${ROOT}/web"
if ! npx playwright install chromium >/dev/null 2>&1; then
  npx playwright install --with-deps chromium
fi

PLAYWRIGHT_LIVE_URL="${BASE}" \
PLAYWRIGHT_LIVE_USER="${USER}" \
PLAYWRIGHT_LIVE_PASS="${PASS}" \
  npm run test:e2e:live-ux

echo "Report: ${ROOT}/docs/ux-wiring-live-report.json"
