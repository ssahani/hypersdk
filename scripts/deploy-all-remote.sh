#!/usr/bin/env bash
# Deprecated — use: ./scripts/deploy remote …
d="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$d/deploy-remote.sh" "$@"
