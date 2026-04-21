#!/usr/bin/env bash
# Deprecated alias — same as scripts/deploy-remote.sh (USER then HOST, then flags).
d="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$d/deploy-remote.sh" "$@"
