#!/usr/bin/env bash
# Verify libvirt / KVM host prerequisites for Machina client bundle.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PASS=0 WARN=0 FAIL=0
ok()   { echo "  OK: $*"; PASS=$((PASS + 1)); }
warn() { echo "  WARN: $*"; WARN=$((WARN + 1)); }
fail() { echo "  FAIL: $*"; FAIL=$((FAIL + 1)); }
skip() { echo "  SKIP: $*"; }

echo "== Machina host test =="

if egrep -q '(vmx|svm)' /proc/cpuinfo 2>/dev/null; then
  ok "CPU virtualization (vmx/svm)"
else
  warn "No vmx/svm in /proc/cpuinfo (nested virt or restricted host?)"
fi

if command -v virsh >/dev/null 2>&1; then
  ok "virsh installed"
  if virsh list --all >/dev/null 2>&1; then
    ok "virsh connects to libvirt"
  elif sudo virsh list --all >/dev/null 2>&1; then
    warn "virsh needs sudo (add user to libvirt group: sudo usermod -aG libvirt \$USER)"
  else
    fail "virsh cannot connect — start libvirtd: sudo systemctl start libvirtd"
  fi
else
  fail "virsh not found (run ./install.sh)"
fi

if systemctl is-active libvirtd >/dev/null 2>&1 || systemctl is-active virtqemud >/dev/null 2>&1; then
  ok "libvirt service active"
else
  warn "libvirtd not active (sudo systemctl start libvirtd)"
fi

if [[ -f /etc/machina/config.toml ]]; then
  ok "/etc/machina/config.toml exists"
elif [[ -f ./config.toml.local ]]; then
  ok "./config.toml.local exists"
else
  warn "No config — copy machina.toml.example to /etc/machina/config.toml"
fi

if [[ -x ./machina-daemon ]]; then
  ok "machina-daemon binary"
else
  fail "machina-daemon missing"
fi

echo ""
echo "Summary: ${PASS} ok, ${WARN} warn, ${FAIL} fail"
[[ "${FAIL}" -eq 0 ]]
