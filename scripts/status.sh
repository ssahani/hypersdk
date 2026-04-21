#!/bin/bash
# virtspawn status — quick overview of your virtualization environment
# Usage: ./scripts/status.sh [API_URL]
set -eo pipefail

API="${1:-https://localhost:5092/api/v1}"

printf "📊 virtspawn status\n\n"

HEALTH=$(curl -sfk "$API/health" 2>/dev/null) || { echo "❌ Daemon not reachable at $API"; exit 1; }
echo "✅ Daemon: healthy  ($API)"
echo ""

# Node info
NODE=$(curl -sfk "$API/node" 2>/dev/null)
if [ -n "$NODE" ]; then
    HOST=$(echo "$NODE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['hostname'])" 2>/dev/null)
    HV=$(echo "$NODE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'{d[\"hypervisor\"]} {d[\"hypervisor_version\"]}')" 2>/dev/null)
    CPUS=$(echo "$NODE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['cpu_cores'])" 2>/dev/null)
    MEM=$(echo "$NODE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'{d[\"memory_mb\"]//1024} GB')" 2>/dev/null)
    LIB=$(echo "$NODE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['lib_version'])" 2>/dev/null)
    echo "🖥️  Host:       $HOST"
    echo "⚙️  Hypervisor: $HV  (libvirt $LIB)"
    echo "💾 Hardware:   $CPUS CPUs, $MEM RAM"
    echo ""
fi

# VMs
VMS=$(curl -sfk "$API/vms" 2>/dev/null)
if [ -n "$VMS" ]; then
    TOTAL=$(echo "$VMS" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null)
    RUNNING=$(echo "$VMS" | python3 -c "import json,sys; print(sum(1 for v in json.load(sys.stdin) if v['state']=='running'))" 2>/dev/null)
    STOPPED=$(echo "$VMS" | python3 -c "import json,sys; print(sum(1 for v in json.load(sys.stdin) if v['state']=='shutoff'))" 2>/dev/null)
    VCPUS=$(echo "$VMS" | python3 -c "import json,sys; print(sum(v['vcpus'] for v in json.load(sys.stdin)))" 2>/dev/null)
    MEMORY=$(echo "$VMS" | python3 -c "import json,sys; print(f'{sum(v[\"memory_mb\"] for v in json.load(sys.stdin))/1024:.1f} GB')" 2>/dev/null)

    echo "💻 Virtual Machines ($TOTAL total, 🟢 $RUNNING running, 🔴 $STOPPED stopped)"
    echo "  Allocated: $VCPUS vCPUs, $MEMORY memory"
    echo ""
    echo "$VMS" | python3 -c "
import json, sys
vms = json.load(sys.stdin)
for v in vms:
    state = v['state']
    dot = '🟢' if state == 'running' else '🔴' if state == 'shutoff' else '🟡'
    print(f'  {dot} {v[\"name\"]:40s} {state:12s} {v[\"vcpus\"]:>2d} vCPU  {v[\"memory_mb\"]:>5d} MB')
" 2>/dev/null
    echo ""
fi

# Metrics for running VMs
METRICS=$(curl -sfk "$API/metrics" 2>/dev/null)
if [ -n "$METRICS" ] && [ "$METRICS" != "[]" ]; then
    echo "📈 Live metrics"
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
NETS=$(curl -sfk "$API/networks" 2>/dev/null)
if [ -n "$NETS" ]; then
    NET_TOTAL=$(echo "$NETS" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null)
    NET_ACTIVE=$(echo "$NETS" | python3 -c "import json,sys; print(sum(1 for n in json.load(sys.stdin) if n['active']))" 2>/dev/null)
    echo "🌐 Networks ($NET_ACTIVE/$NET_TOTAL active)"
    echo "$NETS" | python3 -c "
import json, sys
for n in json.load(sys.stdin):
    st = '✅ active' if n['active'] else '⛔ inactive'
    auto = 'autostart' if n['autostart'] else ''
    print(f'  {n[\"name\"]:25s} {st:14s} bridge:{n[\"bridge\"]:12s} {auto}')
" 2>/dev/null
    echo ""
fi

# Storage
POOLS=$(curl -sfk "$API/storage/pools" 2>/dev/null)
if [ -n "$POOLS" ]; then
    POOL_TOTAL=$(echo "$POOLS" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null)
    echo "💾 Storage pools ($POOL_TOTAL)"
    echo "$POOLS" | python3 -c "
import json, sys
for p in json.load(sys.stdin):
    st = '✅ running' if p['state'] == 'running' else '⛔ ' + p['state']
    pct = (p['allocation_gb'] / p['capacity_gb'] * 100) if p['capacity_gb'] > 0 else 0
    bar_len = 20
    filled = int(pct / 100 * bar_len)
    bar = '▓' * filled + '░' * (bar_len - filled)
    print(f'  {p[\"name\"]:20s} {st:14s} [{bar}] {pct:5.1f}%  {p[\"allocation_gb\"]:.1f}/{p[\"capacity_gb\"]:.1f} GB')
" 2>/dev/null
    echo ""
fi

# Snapshots
SNAPS=$(curl -sfk "$API/snapshots" 2>/dev/null)
if [ -n "$SNAPS" ] && [ "$SNAPS" != "[]" ]; then
    SNAP_COUNT=$(echo "$SNAPS" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null)
    echo "📸 Snapshots ($SNAP_COUNT)"
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
    echo "⚙️  Service"
    icon="✅" ; [[ "$SVC" != "active" ]] && icon="⛔"
    echo "  $icon Status: $SVC  PID: $PID  Memory: $MEM_SVC"
fi
