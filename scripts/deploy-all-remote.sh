#!/usr/bin/env bash
# Deprecated name — use scripts/deploy.sh USER HOST … (note order: user then host)
d="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ $# -ge 2 ]] || { echo "usage: $0 HOST USER [flags...]  →  deploy.sh USER HOST …" >&2; exit 1; }
exec "$d/deploy.sh" "$2" "$1" "${@:3}"
