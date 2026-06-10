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
if ! npm run playwright -- install chromium >/dev/null 2>&1; then
  npm run test:e2e:install
fi

set +e
PLAYWRIGHT_LIVE_URL="${BASE}" \
PLAYWRIGHT_LIVE_USER="${USER}" \
PLAYWRIGHT_LIVE_PASS="${PASS}" \
  npm run test:e2e:live-ux
PW_EXIT=$?
set -e

echo "Report: ${ROOT}/docs/ux-wiring-live-report.json"

"${ROOT}/scripts/lib/send-deploy-report.sh" "${HOST}" \
  --overall "$( [[ $PW_EXIT -eq 0 ]] && echo PASS || echo FAIL )" || true

if [[ "${STRICT:-0}" == "1" && $PW_EXIT -ne 0 ]]; then
  echo "STRICT=1: live UX wiring failed" >&2
  exit "$PW_EXIT"
fi
exit "$PW_EXIT"
