#!/usr/bin/env bash
# Run platform feature matrix: mocked suite locally, then live suite against remote lab.
#
# Usage:
#   VSPASS=max ./scripts/e2e-feature-matrix-remote.sh sus 212.8.252.194
#   PLAYWRIGHT_LIBVIRT_VM_ID=… VSPASS=max ./scripts/e2e-feature-matrix-remote.sh sus HOST
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

USER="${1:?usage: $0 USER HOST}"
HOST="${2:?HOST}"
PASS="${VSPASS:-${SSHPASS:-}}"

if [[ -z "$PASS" ]]; then
  read -rsp "Password for ${USER}@${HOST}: " PASS
  echo
fi

BASE="https://${HOST}:5092"
WEB="${ROOT}/web"

echo "══ Feature matrix (mock) ══"
cd "$WEB"
npm run build
npm run test:e2e:features

echo ""
echo "══ Feature matrix (live @ ${HOST}) ══"
if ! npm run playwright -- install chromium >/dev/null 2>&1; then
  npm run test:e2e:install
fi

VM_ID="${PLAYWRIGHT_LIBVIRT_VM_ID:-}"
if [[ -z "$VM_ID" ]]; then
  VM_ID="$(curl -sk -u "${USER}:${PASS}" "${BASE}/api/v1/platform/controller/api/v1/vms" 2>/dev/null \
    | python3 -c "
import json, sys
try:
    vms = json.load(sys.stdin)
    pick = next((v for v in vms if (v.get('guest_ip') or '').startswith('192.168.')), vms[0] if vms else None)
    print(pick.get('id', '') if pick else '')
except Exception:
    print('')
" 2>/dev/null || true)"
fi

export PLAYWRIGHT_LIVE_URL="$BASE"
export PLAYWRIGHT_LIVE_USER="$USER"
export PLAYWRIGHT_LIVE_PASS="$PASS"
export PLAYWRIGHT_LIBVIRT_VM_ID="$VM_ID"

npm run test:e2e:features:live

echo ""
echo "Feature matrix complete (mock + live)."
