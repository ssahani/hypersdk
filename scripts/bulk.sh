#!/bin/bash
# virtspawn bulk — batch operations on all VMs
# Usage:
#   ./scripts/bulk.sh start          # Start all stopped VMs
#   ./scripts/bulk.sh stop           # Force stop all running VMs
#   ./scripts/bulk.sh shutdown       # Graceful shutdown all running VMs
#   ./scripts/bulk.sh start vm1 vm2  # Start specific VMs
#   ./scripts/bulk.sh snapshot       # Snapshot all running VMs
#   ./scripts/bulk.sh snapshot-clean # Delete all snapshots named 'auto-*'
set -eo pipefail

API="${VIRTSPAWN_API:-http://localhost:5092/api/v1}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail()  { echo -e "${RED}[FAIL]${NC} $*"; }

usage() {
    echo "Usage: $0 <action> [vm1 vm2 ...]"
    echo ""
    echo "Actions:"
    echo "  start          Start all stopped VMs (or specific VMs)"
    echo "  stop           Force stop all running VMs (or specific VMs)"
    echo "  shutdown       Graceful shutdown all running VMs (or specific VMs)"
    echo "  pause          Pause all running VMs"
    echo "  resume         Resume all paused VMs"
    echo "  reboot         Reboot all running VMs"
    echo "  snapshot       Create timestamped snapshot of all running VMs"
    echo "  snapshot-clean Delete all snapshots matching 'auto-*'"
    echo "  status         Quick status of all VMs"
    echo ""
    echo "Environment:"
    echo "  VIRTSPAWN_API  API URL (default: http://localhost:5092/api/v1)"
    exit 1
}

[ $# -eq 0 ] && usage

ACTION="$1"
shift

# Check daemon
curl -sf "$API/health" > /dev/null 2>&1 || { fail "Daemon not reachable at $API"; exit 1; }

# Get VM list
get_vms() {
    curl -sf "$API/vms" 2>/dev/null
}

get_vm_names_by_state() {
    local state="$1"
    get_vms | python3 -c "import json,sys; state=sys.argv[1]; [print(v['name']) for v in json.load(sys.stdin) if v['state']==state]" "$state" 2>/dev/null
}

# If specific VMs given, use those; otherwise use state-based selection
resolve_targets() {
    local default_state="$1"
    if [ $# -gt 1 ]; then
        shift
        echo "$@" | tr ' ' '\n'
    else
        get_vm_names_by_state "$default_state"
    fi
}

do_action() {
    local action="$1" verb="$2" endpoint="$3"
    shift 3
    local targets
    targets=$(resolve_targets "$@")

    if [ -z "$targets" ]; then
        info "No VMs to $verb"
        return
    fi

    echo -e "${BOLD}${verb^} VMs${NC}"

    while read -r name; do
        [ -z "$name" ] && continue
        result=$(curl -s -X POST "$API/vms/$name/$endpoint" 2>/dev/null)
        if echo "$result" | grep -qF "status"; then
            ok "  $name"
        else
            fail "  $name: $result"
        fi
    done <<< "$targets"
}

DATE=$(date +%Y%m%d-%H%M%S)

case "$ACTION" in
    start)
        targets=$(resolve_targets "shutoff" "$@")
        if [ -z "$targets" ]; then
            info "No stopped VMs to start"
            exit 0
        fi
        echo -e "${BOLD}Starting VMs${NC}"
        while read -r name; do
            [ -z "$name" ] && continue
            result=$(curl -s -X POST "$API/vms/$name/start" 2>/dev/null)
            if echo "$result" | grep -qF "started"; then
                ok "  $name"
            else
                fail "  $name: $(echo "$result" | python3 -c "import json,sys; print(json.load(sys.stdin).get('error','unknown'))" 2>/dev/null || echo "$result")"
            fi
        done <<< "$targets"
        ;;

    stop)
        targets=$(resolve_targets "running" "$@")
        if [ -z "$targets" ]; then
            info "No running VMs to stop"
            exit 0
        fi
        echo -e "${BOLD}${RED}Force stopping VMs${NC}"
        while read -r name; do
            [ -z "$name" ] && continue
            result=$(curl -s -X POST "$API/vms/$name/stop" 2>/dev/null)
            if echo "$result" | grep -qF "status"; then
                ok "  $name"
            else
                fail "  $name"
            fi
        done <<< "$targets"
        ;;

    shutdown)
        targets=$(resolve_targets "running" "$@")
        if [ -z "$targets" ]; then
            info "No running VMs to shutdown"
            exit 0
        fi
        echo -e "${BOLD}Shutting down VMs${NC}"
        while read -r name; do
            [ -z "$name" ] && continue
            result=$(curl -s -X POST "$API/vms/$name/shutdown" 2>/dev/null)
            if echo "$result" | grep -qF "status"; then
                ok "  $name"
            else
                fail "  $name"
            fi
        done <<< "$targets"
        ;;

    pause)
        targets=$(resolve_targets "running" "$@")
        if [ -z "$targets" ]; then
            info "No running VMs to pause"
            exit 0
        fi
        echo -e "${BOLD}Pausing VMs${NC}"
        while read -r name; do
            [ -z "$name" ] && continue
            result=$(curl -s -X POST "$API/vms/$name/pause" 2>/dev/null)
            if echo "$result" | grep -qF "status"; then
                ok "  $name"
            else
                fail "  $name"
            fi
        done <<< "$targets"
        ;;

    resume)
        targets=$(resolve_targets "paused" "$@")
        if [ -z "$targets" ]; then
            info "No paused VMs to resume"
            exit 0
        fi
        echo -e "${BOLD}Resuming VMs${NC}"
        while read -r name; do
            [ -z "$name" ] && continue
            result=$(curl -s -X POST "$API/vms/$name/resume" 2>/dev/null)
            if echo "$result" | grep -qF "status"; then
                ok "  $name"
            else
                fail "  $name"
            fi
        done <<< "$targets"
        ;;

    reboot)
        targets=$(resolve_targets "running" "$@")
        if [ -z "$targets" ]; then
            info "No running VMs to reboot"
            exit 0
        fi
        echo -e "${BOLD}Rebooting VMs${NC}"
        while read -r name; do
            [ -z "$name" ] && continue
            result=$(curl -s -X POST "$API/vms/$name/reboot" 2>/dev/null)
            if echo "$result" | grep -qF "status"; then
                ok "  $name"
            else
                fail "  $name"
            fi
        done <<< "$targets"
        ;;

    snapshot)
        targets=$(get_vm_names_by_state "running")
        if [ -z "$targets" ]; then
            info "No running VMs to snapshot"
            exit 0
        fi
        SNAP_NAME="auto-$DATE"
        echo -e "${BOLD}Creating snapshots${NC} ($SNAP_NAME)"
        while read -r name; do
            [ -z "$name" ] && continue
            result=$(curl -s -X POST "$API/vms/$name/snapshots" \
                -H 'Content-Type: application/json' \
                -d "{\"name\": \"$SNAP_NAME\", \"description\": \"Auto backup $DATE\"}" 2>/dev/null)
            if echo "$result" | grep -qF "created"; then
                ok "  $name -> $SNAP_NAME"
            else
                fail "  $name: $(echo "$result" | python3 -c "import json,sys; print(json.load(sys.stdin).get('error','unknown'))" 2>/dev/null || echo "$result")"
            fi
        done <<< "$targets"
        ;;

    snapshot-clean)
        SNAPS=$(curl -sf "$API/snapshots" 2>/dev/null)
        if [ -z "$SNAPS" ] || [ "$SNAPS" = "[]" ]; then
            info "No snapshots found"
            exit 0
        fi
        echo -e "${BOLD}Cleaning auto-* snapshots${NC}"
        echo "$SNAPS" | python3 -c "
import json, sys
for s in json.load(sys.stdin):
    if s['name'].startswith('auto-'):
        print(f'{s[\"vm_name\"]} {s[\"name\"]}')
" 2>/dev/null | while read -r vm snap; do
            [ -z "$vm" ] && continue
            result=$(curl -s -X DELETE "$API/vms/$vm/snapshots/$snap" 2>/dev/null)
            if echo "$result" | grep -qF "deleted"; then
                ok "  $vm/$snap"
            else
                fail "  $vm/$snap"
            fi
        done
        ;;

    status)
        get_vms | python3 -c "
import json, sys
vms = json.load(sys.stdin)
running = [v for v in vms if v['state'] == 'running']
stopped = [v for v in vms if v['state'] == 'shutoff']
other = [v for v in vms if v['state'] not in ('running', 'shutoff')]
print(f'Total: {len(vms)}  Running: {len(running)}  Stopped: {len(stopped)}  Other: {len(other)}')
print()
for v in vms:
    state = v['state']
    c = '\033[0;32m' if state == 'running' else '\033[0;31m' if state == 'shutoff' else '\033[1;33m'
    print(f'  {c}{state:12s}\033[0m {v[\"name\"]:40s} {v[\"vcpus\"]:>2d} vCPU  {v[\"memory_mb\"]:>5d} MB')
" 2>/dev/null
        ;;

    *)
        fail "Unknown action: $ACTION"
        usage
        ;;
esac
