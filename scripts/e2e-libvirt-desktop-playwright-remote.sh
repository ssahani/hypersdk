#!/usr/bin/env bash
# Run Playwright live VNC spec for libvirt ubuntu-desktop from this laptop.
#
# Usage:
#   VSPASS=max ./scripts/e2e-libvirt-desktop-playwright-remote.sh sus 212.8.252.194 [VM_ID]
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"

USER="${1:?usage: $0 USER HOST [VM_ID]}"
HOST="${2:?usage: $0 USER HOST [VM_ID]}"
VM_ID="${3:-}"

PASS="${VSPASS:-${SSHPASS:-}}"
if [[ -z "$PASS" ]]; then
  read -rsp "Password for ${USER}@${HOST}: " PASS
  echo
fi

if [[ -z "$VM_ID" && -f /tmp/machina-ubuntu-desktop-e2e.env ]]; then
  # shellcheck disable=SC1091
  source /tmp/machina-ubuntu-desktop-e2e.env
  VM_ID="${E2E_LIBVIRT_VM_ID:-${VM_ID:-}}"
fi

if [[ -z "$VM_ID" ]]; then
  VM_ID="$(curl -sk -u "${USER}:${PASS}" "http://${HOST}:5093/api/v1/vms" | python3 -c "
import json, sys
for v in json.load(sys.stdin):
    if v.get('name') == 'ubuntu-desktop':
        print(v.get('id', ''))
        break
" 2>/dev/null)"
fi

[[ -n "$VM_ID" ]] || { echo "❌ VM id required (ubuntu-desktop not found)" >&2; exit 1; }

cd "${REPO}/web"
if ! npm run playwright -- install chromium >/dev/null 2>&1; then
  npm run test:e2e:install
fi

export PLAYWRIGHT_LIVE_URL="https://${HOST}:5092"
export PLAYWRIGHT_LIVE_USER="${PLAYWRIGHT_LIVE_USER:-${USER}}"
export PLAYWRIGHT_LIVE_PASS="${PLAYWRIGHT_LIVE_PASS:-${PASS}}"
export PLAYWRIGHT_LIBVIRT_VM_ID="${VM_ID}"
export PLAYWRIGHT_LIBVIRT_VM_NAME="${PLAYWRIGHT_LIBVIRT_VM_NAME:-ubuntu-desktop}"

export PLAYWRIGHT_PLATFORM_USER="${PLAYWRIGHT_PLATFORM_USER:-${E2E_PLATFORM_USER:-admin}}"
export PLAYWRIGHT_PLATFORM_PASS="${PLAYWRIGHT_PLATFORM_PASS:-${E2E_PLATFORM_PASS:-}}"

npm run test:e2e -- --workers=1 --timeout=420000 \
  e2e/platform-live-libvirt-desktop.spec.ts
