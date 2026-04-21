#!/usr/bin/env bash
# Deprecated name — use scripts/deploy.sh (same arguments: USER HOST …)
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/deploy.sh" "$@"
