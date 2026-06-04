#!/usr/bin/env bash
# Test QEMU guest agent install state for a libvirt VM on the hypervisor.
# Usage: ./scripts/test-guest-agent.sh [VM_NAME] [LIBVIRT_URI]
set -euo pipefail

VM="${1:-ubuntu-desktop}"
URI="${2:-qemu:///system}"

echo "== Guest agent test: ${VM} (${URI}) =="

xml="$(virsh -c "$URI" dumpxml "$VM" 2>/dev/null || true)"
if [[ -z "$xml" ]]; then
  echo "FAIL: VM not found"
  exit 1
fi

if echo "$xml" | grep -q 'org.qemu.guest_agent.0'; then
  echo "OK  : Virtio channel present in domain XML"
else
  echo "FAIL: Virtio channel missing (run Machina Install guest tools)"
fi

if echo "$xml" | grep -q "org.qemu.guest_agent.0" && ! echo "$xml" | grep -q "state='disconnected'"; then
  echo "OK  : Channel connected"
else
  echo "WARN: Channel disconnected or missing — start qemu-guest-agent inside the guest"
fi

echo "--- guest-ping ---"
if virsh -c "$URI" qemu-agent-command "$VM" '{"execute":"guest-ping"}' 2>/dev/null | grep -q '"return"'; then
  echo "OK  : guest-ping"
  echo "--- guest-info ---"
  virsh -c "$URI" qemu-agent-command "$VM" '{"execute":"guest-info"}' 2>/dev/null | head -5 || true
else
  echo "FAIL: guest-ping (install qemu-guest-agent in VM: apt install qemu-guest-agent && systemctl enable --now qemu-guest-agent)"
fi

echo "--- domifaddr (lease / arp / agent) ---"
virsh -c "$URI" domifaddr "$VM" --source lease 2>/dev/null || true
virsh -c "$URI" domifaddr "$VM" --source arp 2>/dev/null || true
virsh -c "$URI" domifaddr "$VM" --source agent 2>/dev/null || true
