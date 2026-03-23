#!/bin/bash
# virtspawn backup — backup VM configs and optionally disk images
# Usage:
#   ./scripts/backup.sh                    # Backup XML configs only
#   ./scripts/backup.sh --with-disks       # Backup configs + disk images
#   ./scripts/backup.sh --list             # List what would be backed up
#   ./scripts/backup.sh --restore <dir>    # Restore configs from backup
set -eo pipefail

API="${VIRTSPAWN_API:-http://localhost:8081/api/v1}"
BACKUP_DIR="${VIRTSPAWN_BACKUP_DIR:-$HOME/virtspawn-backups}"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_PATH="$BACKUP_DIR/$DATE"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail()  { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }

WITH_DISKS=false
LIST_ONLY=false
RESTORE_DIR=""

for arg in "$@"; do
    case "$arg" in
        --with-disks) WITH_DISKS=true ;;
        --list)       LIST_ONLY=true ;;
        --restore)    shift; RESTORE_DIR="${2:-}" ;;
        --help|-h)
            echo "Usage: $0 [--with-disks] [--list] [--restore <dir>]"
            echo "  --with-disks   Also copy disk images (can be very large)"
            echo "  --list         Show what would be backed up without doing it"
            echo "  --restore DIR  Restore VM configs from a backup directory"
            echo ""
            echo "Environment:"
            echo "  VIRTSPAWN_API        API URL (default: http://localhost:8081/api/v1)"
            echo "  VIRTSPAWN_BACKUP_DIR Backup root (default: ~/virtspawn-backups)"
            exit 0
            ;;
    esac
done

# Handle restore
if [ -n "$RESTORE_DIR" ]; then
    echo -e "${BOLD}Restoring from $RESTORE_DIR${NC}"
    if [ ! -d "$RESTORE_DIR/vms" ]; then
        fail "No vms/ directory in $RESTORE_DIR"
    fi
    for xml in "$RESTORE_DIR"/vms/*.xml; do
        name=$(basename "$xml" .xml)
        info "Defining VM: $name"
        sudo virsh define "$xml" 2>&1 && ok "  $name defined" || warn "  $name failed"
    done
    if [ -d "$RESTORE_DIR/networks" ]; then
        for xml in "$RESTORE_DIR"/networks/*.xml; do
            name=$(basename "$xml" .xml)
            info "Defining network: $name"
            sudo virsh net-define "$xml" 2>&1 && ok "  $name defined" || warn "  $name failed"
        done
    fi
    ok "Restore complete"
    exit 0
fi

# Check daemon
curl -sf "$API/health" > /dev/null 2>&1 || fail "Daemon not reachable at $API"

# Gather data
VMS=$(curl -sf "$API/vms" 2>/dev/null)
NETS=$(curl -sf "$API/networks" 2>/dev/null)
POOLS=$(curl -sf "$API/storage/pools" 2>/dev/null)

VM_NAMES=$(echo "$VMS" | python3 -c "import json,sys; [print(v['name']) for v in json.load(sys.stdin)]" 2>/dev/null)
NET_NAMES=$(echo "$NETS" | python3 -c "import json,sys; [print(n['name']) for n in json.load(sys.stdin)]" 2>/dev/null)

VM_COUNT=$(echo "$VM_NAMES" | grep -c . || true)
NET_COUNT=$(echo "$NET_NAMES" | grep -c . || true)

if $LIST_ONLY; then
    echo -e "${BOLD}Backup plan${NC}"
    echo -e "  VMs ($VM_COUNT):"
    echo "$VM_NAMES" | while read -r name; do
        [ -z "$name" ] && continue
        echo "    $name"
        if $WITH_DISKS; then
            DETAILS=$(curl -sf "$API/vms/$name" 2>/dev/null)
            echo "$DETAILS" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for disk in d.get('disks',[]):
    print(f'      disk: {disk[\"source\"]}')
" 2>/dev/null
        fi
    done
    echo -e "  Networks ($NET_COUNT):"
    echo "$NET_NAMES" | while read -r name; do
        [ -z "$name" ] && continue
        echo "    $name"
    done
    echo ""
    echo -e "  Backup to: $BACKUP_PATH"
    $WITH_DISKS && echo -e "  ${YELLOW}Disk images will be copied (may be large)${NC}"
    exit 0
fi

# Create backup
echo -e "${BOLD}${CYAN}virtspawn backup${NC}"
echo -e "  Destination: $BACKUP_PATH"
echo ""

mkdir -p "$BACKUP_PATH/vms" "$BACKUP_PATH/networks" "$BACKUP_PATH/pools"

# Backup VM XML configs
info "Backing up $VM_COUNT VM configs..."
BACKED=0
echo "$VM_NAMES" | while read -r name; do
    [ -z "$name" ] && continue
    XML=$(curl -sf "$API/vms/$name/xml" 2>/dev/null)
    if [ -n "$XML" ]; then
        echo "$XML" > "$BACKUP_PATH/vms/$name.xml"
        echo "  $name"
    fi
done
ok "VM configs saved"

# Backup network XML configs
info "Backing up $NET_COUNT network configs..."
echo "$NET_NAMES" | while read -r name; do
    [ -z "$name" ] && continue
    XML=$(curl -sf "$API/networks/$name/xml" 2>/dev/null)
    if [ -n "$XML" ]; then
        echo "$XML" > "$BACKUP_PATH/networks/$name.xml"
        echo "  $name"
    fi
done
ok "Network configs saved"

# Backup pool XML configs
POOL_NAMES=$(echo "$POOLS" | python3 -c "import json,sys; [print(p['name']) for p in json.load(sys.stdin)]" 2>/dev/null)
info "Backing up storage pool configs..."
echo "$POOL_NAMES" | while read -r name; do
    [ -z "$name" ] && continue
    XML=$(curl -sf "$API/storage/pools/$name/xml" 2>/dev/null)
    if [ -n "$XML" ]; then
        echo "$XML" > "$BACKUP_PATH/pools/$name.xml"
        echo "  $name"
    fi
done
ok "Pool configs saved"

# Save VM list as JSON
echo "$VMS" | python3 -m json.tool > "$BACKUP_PATH/vms.json" 2>/dev/null
echo "$NETS" | python3 -m json.tool > "$BACKUP_PATH/networks.json" 2>/dev/null
echo "$POOLS" | python3 -m json.tool > "$BACKUP_PATH/pools.json" 2>/dev/null

# Save node info
curl -sf "$API/node" | python3 -m json.tool > "$BACKUP_PATH/node.json" 2>/dev/null

# Optionally backup disk images
if $WITH_DISKS; then
    mkdir -p "$BACKUP_PATH/disks"
    info "Backing up disk images (this may take a while)..."
    echo "$VM_NAMES" | while read -r name; do
        [ -z "$name" ] && continue
        DETAILS=$(curl -sf "$API/vms/$name" 2>/dev/null)
        echo "$DETAILS" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for disk in d.get('disks',[]):
    print(disk['source'])
" 2>/dev/null | while read -r disk_path; do
            [ -z "$disk_path" ] && continue
            if [ -f "$disk_path" ]; then
                disk_name=$(basename "$disk_path")
                echo "  Copying: $disk_path"
                cp "$disk_path" "$BACKUP_PATH/disks/$disk_name"
            else
                warn "  Disk not found: $disk_path"
            fi
        done
    done
    ok "Disk images saved"
fi

# Summary
TOTAL_SIZE=$(du -sh "$BACKUP_PATH" 2>/dev/null | cut -f1)
FILE_COUNT=$(find "$BACKUP_PATH" -type f | wc -l)

echo ""
echo -e "${GREEN}${BOLD}Backup complete${NC}"
echo -e "  Location: $BACKUP_PATH"
echo -e "  Files:    $FILE_COUNT"
echo -e "  Size:     $TOTAL_SIZE"
echo ""
echo -e "  Restore:  $0 --restore $BACKUP_PATH"
