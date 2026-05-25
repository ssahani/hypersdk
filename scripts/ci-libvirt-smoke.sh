#!/usr/bin/env bash
# Lightweight libvirt connectivity check for GitHub Actions (KVM optional).
set -euo pipefail

if ! command -v virsh >/dev/null 2>&1; then
  echo "virsh not installed — skipping libvirt smoke"
  exit 0
fi

echo "libvirt URI: ${LIBVIRT_DEFAULT_URI:-qemu:///system}"
virsh -c "${LIBVIRT_DEFAULT_URI:-qemu:///system}" list --all || {
  echo "virsh list failed (no KVM session is OK on shared runners)"
  exit 0
}

echo "libvirt smoke OK"
