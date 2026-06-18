#!/usr/bin/env bash
# e2e-packetwolf-remote.sh — run PacketWolf Zeus + runtime tiers against a deployed host.
#
# Usage:
#   PACKETWOLF_VERIFY_API_KEY='Admin@321' ./scripts/e2e-packetwolf-remote.sh USER HOST
#   PACKETWOLF_TEST_TIERS=zeus,runtime ./scripts/e2e-packetwolf-remote.sh sus 212.8.252.194
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
USER="${1:?usage: $0 USER HOST}"
HOST="${2:?usage: $0 USER HOST}"
PW_SRC="$(cd "$REPO/.." && pwd)/packetwolf"

if [[ ! -f "$PW_SRC/scripts/test-all-features-remote.sh" ]]; then
  echo "⚠️  No sibling ../packetwolf — skip PacketWolf E2E" >&2
  exit 0
fi

export PACKETWOLF_VERIFY_API_KEY="${PACKETWOLF_VERIFY_API_KEY:-${PACKETWOLF_ADMIN_API_KEY:-Admin@321}}"
export PACKETWOLF_TEST_TIERS="${PACKETWOLF_TEST_TIERS:-zeus,runtime,tetragon}"
export DEPLOY_HOST="$HOST"
export DEPLOY_USER="$USER"

echo "🐺 PacketWolf post-deploy E2E → ${USER}@${HOST} (tiers: ${PACKETWOLF_TEST_TIERS})"
exec "$PW_SRC/scripts/test-all-features-remote.sh" "$HOST" "$USER"
