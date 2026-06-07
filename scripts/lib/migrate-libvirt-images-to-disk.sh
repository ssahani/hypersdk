#!/usr/bin/env bash
# migrate-libvirt-images-to-disk.sh — move /var/lib/libvirt/images to a large disk (bind mount).
#
# Safe default: rsync to TARGET/libvirt/images, bind-mount over the original path
# so libvirt pool XML and Machina paths keep using /var/lib/libvirt/images.
#
#   sudo ./scripts/lib/migrate-libvirt-images-to-disk.sh /sdb
#   sudo ./scripts/lib/migrate-libvirt-images-to-disk.sh /sdb --dry-run
#   sudo ./scripts/lib/migrate-libvirt-images-to-disk.sh /data --shutdown-vms
#
set -euo pipefail

TARGET_ROOT="${1:-/sdb}"
shift || true

DRY_RUN=false
SHUTDOWN_VMS=false
YES=false

usage() {
  cat <<'EOF'
Usage: migrate-libvirt-images-to-disk.sh [TARGET_MOUNT] [options]

  TARGET_MOUNT   Large disk mount (default: /sdb). Images go to TARGET/libvirt/images.

Options:
  --dry-run        Show planned actions only
  --shutdown-vms   virsh shutdown all running domains before copy
  --yes            Skip confirmation prompt
  -h, --help       This help

Example (175.110.114.93):
  sudo ./scripts/lib/migrate-libvirt-images-to-disk.sh /sdb --shutdown-vms --yes
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --shutdown-vms) SHUTDOWN_VMS=true; shift ;;
    --yes) YES=true; shift ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo $0" >&2
  exit 1
fi

SOURCE="/var/lib/libvirt/images"
TARGET="${TARGET_ROOT%/}/libvirt/images"
BACKUP="${SOURCE}.pre-bind-migrate"

log() { printf '▶ %s\n' "$*"; }
run() {
  if $DRY_RUN; then
    printf '[dry-run] %s\n' "$*"
  else
    log "$*"
    eval "$@"
  fi
}

ensure_target_mounted() {
  if mountpoint -q "$TARGET_ROOT" 2>/dev/null; then
    log "Target mount OK: $TARGET_ROOT"
    return 0
  fi
  if [[ -b /dev/sdb1 ]] && ! mountpoint -q "$TARGET_ROOT" 2>/dev/null; then
    log "Mounting /dev/sdb1 -> $TARGET_ROOT"
    run "mkdir -p '$TARGET_ROOT'"
    if ! $DRY_RUN; then
      mount /dev/sdb1 "$TARGET_ROOT" 2>/dev/null || mount /dev/sdb "$TARGET_ROOT" 2>/dev/null || true
    fi
  fi
  if [[ -b /dev/sdb ]] && ! mountpoint -q "$TARGET_ROOT" 2>/dev/null; then
    log "Trying mount /dev/sdb -> $TARGET_ROOT"
    run "mkdir -p '$TARGET_ROOT'"
    if ! $DRY_RUN; then
      mount /dev/sdb "$TARGET_ROOT" 2>/dev/null || true
    fi
  fi
  if ! mountpoint -q "$TARGET_ROOT" 2>/dev/null; then
    echo "ERROR: $TARGET_ROOT is not a mount point. Mount /dev/sdb first, e.g.:" >&2
    echo "  sudo mkdir -p /sdb && sudo mount /dev/sdb1 /sdb   # or whole-disk fs" >&2
    exit 1
  fi
}

already_migrated() {
  if mountpoint -q "$SOURCE" 2>/dev/null; then
    local src
    src="$(findmnt -n -o SOURCE --target "$SOURCE" 2>/dev/null || true)"
    if [[ "$src" == "$TARGET" ]] || [[ "$src" == *"/sdb"* ]]; then
      log "Already bind-mounted: $SOURCE <- $src"
      df -h "$SOURCE" "$TARGET_ROOT"
      exit 0
    fi
  fi
}

main() {
  ensure_target_mounted
  already_migrated

  log "Layout:"
  df -h "$SOURCE" "$TARGET_ROOT" 2>/dev/null || true
  lsblk -o NAME,SIZE,FSTYPE,MOUNTPOINT | sed 's/^/  /'

  local used
  used="$(du -sh "$SOURCE" 2>/dev/null | awk '{print $1}' || echo '?')"
  log "Source $SOURCE uses ~${used}; target ${TARGET}"

  if ! $YES && ! $DRY_RUN; then
    read -r -p "Migrate $SOURCE -> $TARGET and bind-mount? [y/N] " ans
    [[ "${ans,,}" == "y" || "${ans,,}" == "yes" ]] || { echo "Aborted."; exit 1; }
  fi

  if $SHUTDOWN_VMS && command -v virsh &>/dev/null; then
    log "Shutting down running VMs (best-effort)…"
    while read -r name; do
      [[ -z "$name" ]] && continue
      run "virsh shutdown '$name' || true"
    done < <(virsh list --name 2>/dev/null || true)
    if ! $DRY_RUN; then
      sleep 5
      while read -r name; do
        [[ -z "$name" ]] && continue
        virsh destroy "$name" 2>/dev/null || true
      done < <(virsh list --name 2>/dev/null || true)
    fi
  fi

  run "systemctl stop machina-daemon machina-agent 2>/dev/null || true"

  run "mkdir -p '$TARGET'"
  if [[ -d "$BACKUP" ]]; then
    echo "ERROR: backup $BACKUP already exists — resolve manually" >&2
    exit 1
  fi

  run "rsync -aHAX --info=progress2 '$SOURCE/' '$TARGET/'"

  if ! mountpoint -q "$SOURCE" 2>/dev/null; then
    if [[ -d "$SOURCE" ]] && [[ "$(ls -A "$SOURCE" 2>/dev/null | wc -l)" -gt 0 ]]; then
      run "mv '$SOURCE' '$BACKUP'"
      run "mkdir -p '$SOURCE'"
      run "chmod 0711 '$SOURCE'"
    fi
  fi

  FSTAB_LINE="${TARGET} ${SOURCE} none bind 0 0"
  if ! $DRY_RUN; then
    if ! grep -qF "$FSTAB_LINE" /etc/fstab 2>/dev/null; then
      printf '%s\n' "$FSTAB_LINE" >> /etc/fstab
      log "Added fstab bind entry"
    fi
    mount --bind "$TARGET" "$SOURCE"
  else
    run "echo '$FSTAB_LINE' >> /etc/fstab"
    run "mount --bind '$TARGET' '$SOURCE'"
  fi

  run "virsh pool-refresh default 2>/dev/null || true"
  run "systemctl start machina-daemon machina-agent 2>/dev/null || true"

  log "Done. Verify:"
  if ! $DRY_RUN; then
    df -h "$SOURCE" "$TARGET_ROOT"
    findmnt "$SOURCE" || true
    virsh pool-info default 2>/dev/null || true
    echo "Backup kept at $BACKUP — remove after validation: rm -rf '$BACKUP'"
  fi
}

main
