#!/usr/bin/env bash
# Deprecated name — use: scripts/deploy-remote.sh check [USER@HOST | USER HOST]
d="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "${1:-}" == --ssh ]]; then shift; exec "$d/deploy-remote.sh" check "${1:?}"; fi
exec "$d/deploy-remote.sh" check "$@"
