#!/usr/bin/env bash
# Machina platform host enrollment helper (also served at GET /install.sh on the controller).
set -euo pipefail
CONTROLLER=""
TOKEN=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --controller) CONTROLLER="$2"; shift 2 ;;
    --token) TOKEN="$2"; shift 2 ;;
    *) shift ;;
  esac
done
: "${CONTROLLER:?set --controller URL}"
: "${TOKEN:?set --token TOKEN}"
echo "Joining Machina controller at $CONTROLLER"
if command -v machina-agent >/dev/null 2>&1; then
  exec machina-agent join --controller "$CONTROLLER" --token "$TOKEN"
fi
echo "machina-agent not found — build or install machina-agent, then run:"
echo "  machina-agent join --controller \"$CONTROLLER\" --token \"$TOKEN\""
