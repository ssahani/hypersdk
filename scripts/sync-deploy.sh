#!/usr/bin/env bash
# Deprecated name — use scripts/deploy-remote.sh (same arguments: USER HOST …)
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/deploy-remote.sh" "$@"
