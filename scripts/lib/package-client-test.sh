#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
echo "== Machina package test =="
test -x ./machina-daemon || { echo "FAIL: machina-daemon"; exit 1; }
./machina-daemon --help 2>&1 | head -3 || true
if [ -x ./test-host.sh ]; then
  ./test-host.sh || echo "  WARN: test-host.sh — see HOST_SETUP.txt"
fi
if curl -skf https://127.0.0.1:5092/health >/dev/null 2>&1; then
  echo "  OK: machina-daemon health :5092"
else
  echo "  SKIP: configure /etc/machina/config.toml and start machina-daemon"
fi
echo "Done."
