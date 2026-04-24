#!/usr/bin/env bash
# Deprecated alias — same as scripts/deploy-remote.sh (USER then HOST, then flags; see --remote-check / --remote-build there).
d="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$d/deploy-remote.sh" "$@"
