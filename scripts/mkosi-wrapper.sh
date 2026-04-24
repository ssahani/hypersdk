#!/usr/bin/env bash
# machina — mkosi CLI wrapper
# Injects --workspace-directory under /var/tmp when not already set, so the default
# ~/.cache/mkosi workspace is never used under BuildSources= trees (e.g. /home/user).
#
# Real binary: /usr/local/libexec/machina/mkosi-real (symlink installed by install.sh)
# Overrides:
#   MKOSI_WORKSPACE_DIRECTORY  — explicit workspace dir (must be absolute)
#   MACHINA_MKOSI_WORKSPACE_DIR — parent dir; per-user dir is ${DIR}/${USER}-${UID}

set -euo pipefail

REAL="/usr/local/libexec/machina/mkosi-real"
if [ ! -x "$REAL" ]; then
  echo "machina mkosi wrapper: missing or not executable: $REAL" >&2
  exit 127
fi

has_ws=0
prev=""
for a in "$@"; do
  if [ "$prev" = "--workspace-directory" ] || [ "$prev" = "--workspace-dir" ]; then
    has_ws=1
    break
  fi
  case "$a" in
    --workspace-directory=*|--workspace-dir=*) has_ws=1; break ;;
  esac
  prev=$a
done

if [ "$has_ws" -eq 1 ]; then
  exec "$REAL" "$@"
fi

_base="${MACHINA_MKOSI_WORKSPACE_DIR:-/var/tmp/mkosi-workspace}"
_u="${USER:-user}"
_uid="${UID:-$(id -u)}"
_ws="${MKOSI_WORKSPACE_DIRECTORY:-}"
if [ -z "$_ws" ]; then
  _ws="${_base}/${_u}-${_uid}"
fi
case "$_ws" in
  /*) ;;
  *)
    echo "machina mkosi wrapper: workspace path must be absolute: $_ws" >&2
    exit 2
    ;;
esac
mkdir -p "$_ws"
exec "$REAL" --workspace-directory "$_ws" "$@"
