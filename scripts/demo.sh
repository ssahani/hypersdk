#!/bin/bash
# virtspawn demo — exercises the REST API to demonstrate all features
# Usage: ./scripts/demo.sh [API_URL]
set -euo pipefail

API="${1:-http://localhost:8081/api/v1}"

step=0
step() {
    step=$((step + 1))
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📌 Step $step: $*"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

api() {
    local method="$1" path="$2"
    shift 2
    echo "  🔗 ${method} ${path}"
    local result
    if [ "$method" = "GET" ]; then
        result=$(curl -s "${API}${path}")
    elif [ "$method" = "DELETE" ]; then
        result=$(curl -s -X DELETE "${API}${path}")
    else
        result=$(curl -s -X "$method" "${API}${path}" -H 'Content-Type: application/json' "$@")
    fi
    echo "$result" | python3 -m json.tool 2>/dev/null || echo "$result"
    sleep 1
}

DEMO_VM="demo-vm-$$"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  🖥️  virtspawn API Demo                              ║"
echo "║  🔗 API: ${API}"
echo "║  🖥️  Demo VM: ${DEMO_VM}"
echo "╚══════════════════════════════════════════════════════╝"

step "🩺 Health Check"
api GET /health

step "🖥️  Host Information"
api GET /node

step "📦 Available VM Templates"
api GET /templates

step "📋 List Current VMs"
api GET /vms

step "🆕 Create a Demo VM"
api POST /vms -d "{\"name\": \"${DEMO_VM}\", \"vcpus\": 1, \"memory_mb\": 512, \"disk_gb\": 5, \"network\": \"default\"}"

step "✅ Verify VM Created"
api GET /vms

step "🔍 Get VM Details"
api GET /vms/${DEMO_VM}

step "▶️  Start VM"
api POST /vms/${DEMO_VM}/start
sleep 2

step "📊 Get VM Metrics"
api GET /metrics/${DEMO_VM}

step "📊 All VM Metrics"
api GET /metrics

step "🖥️  Console Info (VNC port)"
api GET /vms/console-info/${DEMO_VM}

step "📄 Get VM XML Definition"
echo "  🔗 GET /vms/demo-vm/xml"
curl -s "${API}/vms/${DEMO_VM}/xml" | head -20
echo "  ... (truncated)"
sleep 1

step "🔁 Enable Autostart"
api POST /vms/${DEMO_VM}/autostart/true

step "📸 Create Snapshot"
api POST /vms/${DEMO_VM}/snapshots -d '{"name": "demo-snap", "description": "Demo snapshot"}'

step "📸 List All Snapshots"
api GET /snapshots

step "⏪ Revert to Snapshot"
api POST /vms/${DEMO_VM}/snapshots/demo-snap/revert

step "🌐 List Networks"
api GET /networks

step "💾 List Storage Pools"
api GET /storage/pools

step "📈 Prometheus Metrics (first 20 lines)"
echo "  🔗 GET /prometheus"
curl -s "${API}/prometheus" | head -20
echo "  ... (truncated)"
sleep 1

step "⏹️  Shutdown VM"
api POST /vms/${DEMO_VM}/shutdown
sleep 3

step "🗑️  Delete Snapshot"
api DELETE /vms/${DEMO_VM}/snapshots/demo-snap

step "🗑️  Delete Demo VM"
api DELETE /vms/${DEMO_VM}
# Clean up disk image
rm -f /var/lib/libvirt/images/${DEMO_VM}.qcow2 2>/dev/null

step "📋 Final VM List"
api GET /vms

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  ✅ Demo Complete!                                   ║"
echo "║                                                      ║"
echo "║  🌐 Web UI:  http://localhost:8081                   ║"
echo "║  🖥️  TUI:     virtspawn                              ║"
echo "║  🔗 API:     ${API}/health"
echo "╚══════════════════════════════════════════════════════╝"
