#!/usr/bin/env bash
# Machina — one-command client install (run inside extracted tarball directory).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Machina client install                                  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

echo "► Step 1/4 — System dependencies (libvirt, build libs)…"
if [ -x ./install-client-deps.sh ]; then
  sudo ./install-client-deps.sh
elif [ -x ./install.sh ]; then
  sudo ./install.sh --deps-only
else
  echo "  ERROR: no dependency installer found"; exit 1
fi

echo ""
echo "► Step 2/4 — Configuration…"
sudo mkdir -p /etc/machina /var/lib/machina 2>/dev/null || true
if [ -f machina.toml.example ] && [ ! -f /etc/machina/config.toml ]; then
  sudo cp machina.toml.example /etc/machina/config.toml
  echo "  Created /etc/machina/config.toml — edit before production use."
else
  cp machina.toml.example ./config.toml.local 2>/dev/null || true
  echo "  Edit /etc/machina/config.toml or ./config.toml.local"
fi

echo ""
echo "► Step 3/4 — Verify binaries…"
test -x ./machina-daemon || { echo "ERROR: machina-daemon missing"; exit 1; }
echo "  OK: machina-daemon"

echo ""
echo "► Step 4/4 — Smoke test…"
[ -x ./test-package.sh ] && ./test-package.sh || true

echo ""
echo "  Remove: ./uninstall.sh --yes  (add --remove-dir to delete this folder)"
echo "══════════════════════════════════════════════════════════"
echo "  Install complete."
echo ""
echo "  Start daemon:"
echo "    sudo ./machina-daemon --config /etc/machina/config.toml"
echo "  Or:   ./machina-daemon --config ./config.toml.local"
echo "  Open: https://<this-server>:5092"
echo ""
echo "  Host checks: ./test-host.sh  (libvirt/KVM — see HOST_SETUP.txt)"
echo "  Test: ./test-package.sh"
echo "  Help: HOST_SETUP.txt  PREREQUISITES.txt"
echo "  Remove: ./uninstall.sh --yes  (add --remove-dir to delete this folder)"
echo "══════════════════════════════════════════════════════════"
