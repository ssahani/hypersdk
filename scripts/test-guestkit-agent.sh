#!/usr/bin/env bash
# Test GuestKit guest agent channel + RPC for a libvirt VM on the hypervisor.
# Usage: ./scripts/test-guestkit-agent.sh [VM_NAME] [LIBVIRT_URI]
set -euo pipefail

VM="${1:-}"
URI="${2:-qemu:///system}"
export MACHINA_GUEST_AGENT="${MACHINA_GUEST_AGENT:-auto}"

if [[ -z "$VM" ]]; then
  VM="$(virsh -c "$URI" list --name --state-running 2>/dev/null | head -1 || true)"
fi
if [[ -z "$VM" ]]; then
  echo "SKIP: no running VM (pass VM_NAME or start a guest)"
  exit 0
fi

echo "== GuestKit agent test: ${VM} (${URI}) MACHINA_GUEST_AGENT=${MACHINA_GUEST_AGENT} =="

xml="$(virsh -c "$URI" dumpxml "$VM" 2>/dev/null || true)"
if [[ -z "$xml" ]]; then
  echo "FAIL: VM not found"
  exit 1
fi

if echo "$xml" | grep -q 'com.zyvor.guestkit.0'; then
  echo "OK  : GuestKit virtio channel in domain XML"
else
  echo "FAIL: com.zyvor.guestkit.0 missing (Machina Install guest tools)"
  exit 1
fi

if echo "$xml" | grep -q "com.zyvor.guestkit.0" && ! echo "$xml" | grep -q "state='disconnected'"; then
  echo "OK  : GuestKit channel connected"
else
  echo "WARN: GuestKit channel disconnected — start guestkit-agent in guest"
fi

id="$(virsh -c "$URI" dominfo "$VM" 2>/dev/null | awk '/^Id:/ {print $2}')"
sock="/var/lib/libvirt/qemu/channel/target/domain-${id}/com.zyvor.guestkit.0"
if [[ -S "$sock" ]]; then
  echo "OK  : socket $sock"
else
  echo "WARN: socket not found at $sock"
fi

if command -v guestkit &>/dev/null && [[ -S "$sock" ]]; then
  echo "--- guestkit agent-proxy ping ---"
  timeout 15 guestkit agent-proxy --socket "$sock" --listen 127.0.0.1:8765 2>/dev/null &
  proxy_pid=$!
  sleep 1
  if curl -sf "http://127.0.0.1:8765/ping" >/dev/null 2>&1; then
    echo "OK  : agent-proxy /ping"
    curl -sf "http://127.0.0.1:8765/evidence" | head -c 200 && echo "..."
  else
    echo "FAIL: agent-proxy /ping (is guestkit-agent running in VM?)"
  fi
  kill "$proxy_pid" 2>/dev/null || true
  wait "$proxy_pid" 2>/dev/null || true
fi

echo "--- QGA fallback (graceful shutdown channel) ---"
if virsh -c "$URI" qemu-agent-command "$VM" '{"execute":"guest-ping"}' 2>/dev/null | grep -q '"return"'; then
  echo "OK  : qemu-guest-agent guest-ping (optional)"
else
  echo "NOTE: QGA not responding (OK if GuestKit-only)"
fi

echo "DONE"
