#!/usr/bin/env bash
# Client-side runtime dependencies for Machina bundle (do not call ./install.sh — that recurses).
set -euo pipefail
echo "== Machina client dependencies =="
SUDO=""
[ "$(id -u)" -ne 0 ] && command -v sudo &>/dev/null && SUDO=sudo
if command -v dnf &>/dev/null; then
  $SUDO dnf install -y libvirt libvirt-devel qemu-kvm 2>&1 | tail -8 || true
elif command -v apt-get &>/dev/null; then
  $SUDO apt-get update -qq && $SUDO apt-get install -y libvirt-daemon-system qemu-kvm 2>&1 | tail -8 || true
fi
echo "  libvirt/qemu packages installed or already present."
echo "Done."
