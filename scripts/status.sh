#!/bin/bash
# virtspawn status — quick overview of your virtualization environment
# Usage: ./scripts/status.sh [API_URL]
set -eo pipefail

API="${1:-http://localhost:8081/api/v1}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# Check daemon
printf "${BOLD}${CYAN}virtspawn status${NC}\n\n"

HEALTH=$(curl -sf "$API/health" 2>/dev/null) || { echo -e "${RED}Daemon not reachable at $API${NC}"; exit 1; }
echo -e "${GREEN}Daemon: healthy${NC}  ($API)"
echo ""

# Node info
NODE=$(curl -sf "$API/node" 2>/dev/null)
if [ -n "$NODE" ]; then
    HOST=$(echo "$NODE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['hostname'])" 2>/dev/null)
    HV=$(echo "$NODE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'{d[\"hypervisor\"]} {d[\"hypervisor_version\"]}')" 2>/dev/null)
    CPUS=$(echo "$NODE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['cpu_cores'])" 2>/dev/null)
    MEM=$(echo "$NODE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'{d[\"memory_mb\"]//1024} GB')" 2>/dev/null)
    LIB=$(echo "$NODE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['lib_version'])" 2>/dev/null)
    echo -e "${BOLD}Host:${NC}       $HOST"
    echo -e "${BOLD}Hypervisor:${NC} $HV  (libvirt $LIB)"
    echo -e "${BOLD}Hardware:${NC}   $CPUS CPUs, $MEM RAM"
    echo ""
fi

# VMs
VMS=$(curl -sf "$API/vms" 2>/dev/null)
if [ -n "$VMS" ]; then
    TOTAL=$(echo "$VMS" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null)
    RUNNING=$(echo "$VMS" | python3 -c "import json,sys; print(sum(1 for v in json.load(sys.stdin) if v['state']=='running'))" 2>/dev/null)
    STOPPED=$(echo "$VMS" | python3 -c "import json,sys; print(sum(1 for v in json.load(sys.stdin) if v['state']=='shutoff'))" 2>/dev/null)
    VCPUS=$(echo "$VMS" | python3 -c "import json,sys; print(sum(v['vcpus'] for v in json.load(sys.stdin)))" 2>/dev/null)
    MEMORY=$(echo "$VMS" | python3 -c "import json,sys; print(f'{sum(v[\"memory_mb\"] for v in json.load(sys.stdin))/1024:.1f} GB')" 2>/dev/null)

    echo -e "${BOLD}Virtual Machines${NC} ($TOTAL total, ${GREEN}$RUNNING running${NC}, ${RED}$STOPPED stopped${NC})"
    echo -e "  Allocated: $VCPUS vCPUs, $MEMORY memory"
    echo ""
    echo "$VMS" | python3 -c "
import json, sys
vms = json.load(sys.stdin)
for v in vms:
    state = v['state']
    color = '\033[0;32m' if state == 'running' else '\033[0;31m' if state == 'shutoff' else '\033[1;33m'
    dot = '*' if state == 'running' else ' '
    print(f'  {dot} {v[\"name\"]:40s} {color}{state:12s}\033[0m {v[\"vcpus\"]:>2d} vCPU  {v[\"memory_mb\"]:>5d} MB')
" 2>/dev/null
    echo ""
fi

# Metrics for running VMs
METRICS=$(curl -sf "$API/metrics" 2>/dev/null)
if [ -n "$METRICS" ] && [ "$METRICS" != "[]" ]; then
    echo -e "${BOLD}Live Metrics${NC}"
    echo "$METRICS" | python3 -c "
import json, sys
metrics = json.load(sys.stdin)
if metrics:
    print(f'  {\"VM\":<35s} {\"Mem %\":>6s}  {\"Disk Rd\":>10s}  {\"Disk Wr\":>10s}  {\"Net RX\":>10s}  {\"Net TX\":>10s}')
    print(f'  {\"-\"*35} {\"-\"*6}  {\"-\"*10}  {\"-\"*10}  {\"-\"*10}  {\"-\"*10}')
    for m in metrics:
        def fmt(b):
            if b > 1073741824: return f'{b/1073741824:.1f} GB'
            if b > 1048576: return f'{b/1048576:.1f} MB'
            if b > 1024: return f'{b/1024:.1f} KB'
            return f'{b} B'
        print(f'  {m[\"name\"]:<35s} {m[\"memory_pct\"]:>5.1f}%  {fmt(m[\"disk_rd_bytes\"]):>10s}  {fmt(m[\"disk_wr_bytes\"]):>10s}  {fmt(m[\"net_rx_bytes\"]):>10s}  {fmt(m[\"net_tx_bytes\"]):>10s}')
" 2>/dev/null
    echo ""
fi

# Networks
NETS=$(curl -sf "$API/networks" 2>/dev/null)
if [ -n "$NETS" ]; then
    NET_TOTAL=$(echo "$NETS" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null)
    NET_ACTIVE=$(echo "$NETS" | python3 -c "import json,sys; print(sum(1 for n in json.load(sys.stdin) if n['active']))" 2>/dev/null)
    echo -e "${BOLD}Networks${NC} ($NET_ACTIVE/$NET_TOTAL active)"
    echo "$NETS" | python3 -c "
import json, sys
for n in json.load(sys.stdin):
    st = '\033[0;32mactive\033[0m' if n['active'] else '\033[0;31minactive\033[0m'
    auto = 'autostart' if n['autostart'] else ''
    print(f'  {n[\"name\"]:25s} {st:20s} bridge:{n[\"bridge\"]:12s} {auto}')
" 2>/dev/null
    echo ""
fi

# Storage
POOLS=$(curl -sf "$API/storage/pools" 2>/dev/null)
if [ -n "$POOLS" ]; then
    POOL_TOTAL=$(echo "$POOLS" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null)
    echo -e "${BOLD}Storage Pools${NC} ($POOL_TOTAL)"
    echo "$POOLS" | python3 -c "
import json, sys
for p in json.load(sys.stdin):
    st = '\033[0;32mrunning\033[0m' if p['state'] == 'running' else '\033[0;31m' + p['state'] + '\033[0m'
    pct = (p['allocation_gb'] / p['capacity_gb'] * 100) if p['capacity_gb'] > 0 else 0
    bar_len = 20
    filled = int(pct / 100 * bar_len)
    bar = '\033[0;32m' + '#' * filled + '\033[0m' + '-' * (bar_len - filled)
    print(f'  {p[\"name\"]:20s} {st:20s} [{bar}] {pct:5.1f}%  {p[\"allocation_gb\"]:.1f}/{p[\"capacity_gb\"]:.1f} GB')
" 2>/dev/null
    echo ""
fi

# Snapshots
SNAPS=$(curl -sf "$API/snapshots" 2>/dev/null)
if [ -n "$SNAPS" ] && [ "$SNAPS" != "[]" ]; then
    SNAP_COUNT=$(echo "$SNAPS" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null)
    echo -e "${BOLD}Snapshots${NC} ($SNAP_COUNT)"
    echo "$SNAPS" | python3 -c "
import json, sys
for s in json.load(sys.stdin):
    cur = ' (current)' if s.get('is_current') else ''
    print(f'  {s[\"vm_name\"]:25s} {s[\"name\"]:20s} {s[\"state\"]:10s}{cur}')
" 2>/dev/null
    echo ""
fi

# Service status
if command -v systemctl &>/dev/null; then
    SVC=$(systemctl is-active virtspawn-daemon 2>/dev/null) || SVC="unknown"
    PID=$(systemctl show virtspawn-daemon --property=MainPID --value 2>/dev/null) || PID=""
    MEM_SVC=$(ps -o rss= -p "$PID" 2>/dev/null | awk '{printf "%.1f MB", $1/1024}') || MEM_SVC=""
    echo -e "${BOLD}Service${NC}"
    echo -e "  Status: ${GREEN}$SVC${NC}  PID: $PID  Memory: $MEM_SVC"
fi
