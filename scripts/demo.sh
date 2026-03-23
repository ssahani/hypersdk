#!/bin/bash
# virtspawn demo — exercises the REST API to demonstrate all features
# Usage: ./scripts/demo.sh [API_URL]
set -eo pipefail

API="${1:-http://localhost:8081/api/v1}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

step_n=0
step() {
    step_n=$((step_n + 1))
    echo ""
    echo -e "${CYAN}${BOLD}[$step_n] $*${NC}"
    echo -e "${CYAN}$(printf '%.0s-' {1..60})${NC}"
}

api() {
    local method="$1" path="$2"
    shift 2
    echo -e "  ${BLUE}${method}${NC} ${path}"
    local result
    if [ "$method" = "GET" ]; then
        result=$(curl -s "${API}${path}")
    elif [ "$method" = "DELETE" ]; then
        result=$(curl -s -X DELETE "${API}${path}")
    else
        result=$(curl -s -X "$method" "${API}${path}" -H 'Content-Type: application/json' "$@")
    fi
    echo "$result" | python3 -m json.tool 2>/dev/null || echo "$result" | head -20
    sleep 1
}

DEMO_VM="demo-vm-$$"

echo ""
echo -e "${BOLD}${CYAN}virtspawn API Demo${NC}"
echo -e "  API: ${API}"
echo -e "  Demo VM: ${DEMO_VM}"
echo ""

# ── Health & Node ──────────────────────────────────────────────────────

step "Health Check"
api GET /health

step "Host Information"
api GET /node

step "VM Templates"
api GET /templates

# ── VM Lifecycle ───────────────────────────────────────────────────────

step "List Current VMs"
api GET /vms

step "Create a Demo VM"
api POST /vms -d "{\"name\": \"${DEMO_VM}\", \"vcpus\": 1, \"memory_mb\": 512, \"disk_gb\": 5, \"network\": \"default\"}"

step "Get VM Details"
api GET /vms/${DEMO_VM}

step "Start VM"
api POST /vms/${DEMO_VM}/start
sleep 2

step "Get VM Metrics"
api GET /metrics/${DEMO_VM}

step "Console Info"
api GET /vms/console-info/${DEMO_VM}

step "Get Boot Configuration"
api GET /vms/${DEMO_VM}/boot

step "Check Managed Save Status"
api GET /vms/${DEMO_VM}/managed-save/status

step "Enable Autostart"
api POST /vms/${DEMO_VM}/autostart/true

# ── Snapshots ──────────────────────────────────────────────────────────

step "Create Snapshot"
api POST /vms/${DEMO_VM}/snapshots -d '{"name": "demo-snap", "description": "Demo snapshot"}'

step "List All Snapshots"
api GET /snapshots

step "Revert to Snapshot"
api POST /vms/${DEMO_VM}/snapshots/demo-snap/revert

# ── Networks ───────────────────────────────────────────────────────────

step "List Networks"
api GET /networks

# ── Storage ────────────────────────────────────────────────────────────

step "List Storage Pools"
api GET /storage/pools

# ── Advanced: Infrastructure ──────────────────────────────────────────

step "Hypervisor Capabilities"
echo -e "  ${BLUE}GET${NC} /capabilities"
curl -s "${API}/capabilities" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(f'  Host arch: {d.get(\"host_arch\",\"?\")}')
print(f'  CPU model: {d.get(\"host_cpu_model\",\"?\")}')
print(f'  Guest types: {len(d.get(\"guests\",[]))}')
" 2>/dev/null || echo "  (capabilities endpoint)"
sleep 1

step "System Info (SMBIOS)"
echo -e "  ${BLUE}GET${NC} /sysinfo"
curl -s "${API}/sysinfo" | head -10
echo "  ... (truncated)"
sleep 1

step "Node Devices"
echo -e "  ${BLUE}GET${NC} /devices"
curl -s "${API}/devices" | python3 -c "
import json,sys
devs=json.load(sys.stdin)
types={}
for d in devs:
    t=d.get('capability_type','?')
    types[t]=types.get(t,0)+1
print(f'  Total: {len(devs)} devices')
for t,c in sorted(types.items()):
    print(f'    {t}: {c}')
" 2>/dev/null || echo "  (devices endpoint)"
sleep 1

step "Node Devices (filtered: net only)"
echo -e "  ${BLUE}GET${NC} /devices?capability=net"
curl -s "${API}/devices?capability=net" | python3 -c "
import json,sys
devs=json.load(sys.stdin)
print(f'  Net devices: {len(devs)}')
for d in devs[:5]:
    print(f'    {d[\"name\"]}')
" 2>/dev/null || echo "  (filtered devices)"
sleep 1

step "Network Filters"
echo -e "  ${BLUE}GET${NC} /nwfilters"
curl -s "${API}/nwfilters" | python3 -c "
import json,sys
f=json.load(sys.stdin)
print(f'  {len(f)} network filters')
for x in f[:5]:
    print(f'    {x[\"name\"]}')
if len(f)>5: print(f'    ... and {len(f)-5} more')
" 2>/dev/null || echo "  (nwfilters endpoint)"
sleep 1

step "Secrets"
api GET /secrets

# ── Security Validation ───────────────────────────────────────────────

step "Security: Migration URI Validation"
echo -e "  Testing SSRF prevention..."
echo -e "  ${BLUE}POST${NC} /vms/${DEMO_VM}/migrate with http://evil.com"
result=$(curl -s -X POST "${API}/vms/${DEMO_VM}/migrate" \
    -H 'Content-Type: application/json' \
    -d '{"dest_uri":"http://evil.com","live":false}')
if echo "$result" | grep -qF "Invalid migration URI"; then
    echo -e "  ${GREEN}BLOCKED${NC}: $result"
else
    echo -e "  ${RED}NOT BLOCKED${NC}: $result"
fi
sleep 1

step "Security: Volume Resize Validation"
echo -e "  Testing negative capacity prevention..."
echo -e "  ${BLUE}POST${NC} /storage/pools/default/volumes/x/resize with -1"
result=$(curl -s -X POST "${API}/storage/pools/default/volumes/x/resize" \
    -H 'Content-Type: application/json' \
    -d '{"capacity_gb":-1}')
if echo "$result" | grep -qF "greater than 0"; then
    echo -e "  ${GREEN}BLOCKED${NC}: $result"
else
    echo -e "  ${RED}NOT BLOCKED${NC}: $result"
fi
sleep 1

# ── Prometheus ─────────────────────────────────────────────────────────

step "Prometheus Metrics"
echo -e "  ${BLUE}GET${NC} /prometheus"
curl -s "${API}/prometheus" | head -15
echo "  ... (truncated)"
sleep 1

# ── Cleanup ────────────────────────────────────────────────────────────

step "Shutdown VM"
api POST /vms/${DEMO_VM}/shutdown
sleep 3

step "Delete Snapshot"
api DELETE /vms/${DEMO_VM}/snapshots/demo-snap

step "Delete Demo VM"
api DELETE /vms/${DEMO_VM}
rm -f /var/lib/libvirt/images/${DEMO_VM}.qcow2 2>/dev/null || true

step "Final VM List"
api GET /vms

echo ""
echo -e "${GREEN}${BOLD}Demo Complete!${NC}"
echo ""
echo -e "  Web UI:  ${CYAN}http://localhost:8081${NC}"
echo -e "  TUI:     ${CYAN}virtspawn${NC}"
echo -e "  API:     ${CYAN}${API}/health${NC}"
echo ""
