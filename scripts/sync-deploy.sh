#!/bin/bash
# sync-deploy.sh — Sync source and redeploy to a remote server
#
# Usage:
#   ./scripts/sync-deploy.sh root 185.165.240.5 mypassword
#   ./scripts/sync-deploy.sh root 185.165.240.5 mypassword --bind 0.0.0.0 --open-firewall
#   SYNC_ONLY=1 ./scripts/sync-deploy.sh root 10.0.0.5 pass123
#   ./scripts/sync-deploy.sh --help

set -eo pipefail

info()  { printf '\033[0;36m[INFO]\033[0m %s\n' "$*"; }
ok()    { printf '\033[0;32m[OK]\033[0m %s\n' "$*"; }
fail()  { printf '\033[0;31m[FAIL]\033[0m %s\n' "$*"; exit 1; }

usage() {
    cat <<'EOF'
Usage: sync-deploy.sh USER HOST PASSWORD [INSTALL_OPTS...]

  Syncs the local virtspawn source to a remote server via rsync+sshpass,
  then runs install.sh on the remote host to build and deploy.

Arguments:
  USER        SSH username (e.g., root)
  HOST        Remote host IP or hostname (e.g., 185.165.240.5)
  PASSWORD    SSH password (passed via SSHPASS env var to sshpass)

Install options (forwarded to remote install.sh):
  --bind HOST        Bind daemon to HOST (use 0.0.0.0 for remote access)
  --open-firewall    Open port 8081 in remote firewall
  --deps-only        Only install dependencies
  --no-start         Don't start the daemon after install

Examples:
  # Full deploy with remote access
  ./scripts/sync-deploy.sh root 185.165.240.5 's3cret' --bind 0.0.0.0 --open-firewall

  # Sync only (no install)
  SYNC_ONLY=1 ./scripts/sync-deploy.sh root 10.0.0.5 'pass123'

Environment:
  SYNC_ONLY=1         Only rsync, don't run install.sh
  REMOTE_DIR=path     Remote source directory (default: ~/.virtspawn)
  SSH_PORT=port       SSH port (default: 22)
EOF
    exit 0
}

# ── Parse args ──────────────────────────────────────────────────────

[ $# -lt 1 ] && usage
[ "$1" = "--help" ] || [ "$1" = "-h" ] && usage
[ $# -lt 3 ] && fail "Usage: $0 USER HOST PASSWORD [INSTALL_OPTS...]"

USER="$1"
HOST="$2"
PASSWORD="$3"
shift 3

[ -z "$USER" ] && fail "USER cannot be empty"
[ -z "$HOST" ] && fail "HOST cannot be empty"
[ -z "$PASSWORD" ] && fail "PASSWORD cannot be empty"

REMOTE_DIR="${REMOTE_DIR:-~/.virtspawn}"
SSH_PORT="${SSH_PORT:-22}"
SYNC_ONLY="${SYNC_ONLY:-0}"
REMOTE="$USER@$HOST"

# ── Validate tools ──────────────────────────────────────────────────

command -v sshpass &>/dev/null || fail "sshpass is required. Install: sudo dnf install sshpass / sudo apt install sshpass"
command -v rsync &>/dev/null || fail "rsync is required. Install: sudo dnf install rsync / sudo apt install rsync"

# Find source directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ ! -f "$SOURCE_DIR/Cargo.toml" ] || [ ! -f "$SOURCE_DIR/Makefile" ]; then
    fail "Cannot find virtspawn source. Run from the repo root or scripts/ directory."
fi

# Use SSHPASS env var instead of -p flag (avoids password in process list)
export SSHPASS="$PASSWORD"

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=10 -p "$SSH_PORT")

# ── Test connection ─────────────────────────────────────────────────

info "Testing SSH connection to $REMOTE:$SSH_PORT ..."
REMOTE_HOSTNAME=$(sshpass -e ssh "${SSH_OPTS[@]}" "$REMOTE" 'hostname' 2>/dev/null) || fail "Cannot connect to $REMOTE (check host/user/password/port)"
ok "Connected to $REMOTE_HOSTNAME"

# ── Sync source ─────────────────────────────────────────────────────

info "Syncing source to $REMOTE:$REMOTE_DIR ..."
sshpass -e rsync -az --delete \
    -e "ssh ${SSH_OPTS[*]}" \
    --exclude target \
    --exclude node_modules \
    --exclude .git \
    "$SOURCE_DIR/" "$REMOTE:$REMOTE_DIR/" || fail "rsync failed"

FILE_COUNT=$(sshpass -e ssh "${SSH_OPTS[@]}" "$REMOTE" "find $REMOTE_DIR -type f 2>/dev/null | wc -l" 2>/dev/null) || FILE_COUNT="?"
ok "Source synced ($FILE_COUNT files)"

# ── Run install (unless SYNC_ONLY) ──────────────────────────────────

if [ "$SYNC_ONLY" = "1" ]; then
    ok "Sync complete (SYNC_ONLY=1, skipping install)"
    printf '\n  To install manually:\n'
    printf '    ssh %s '\''cd %s && sudo bash install.sh'\'' \n\n' "$REMOTE" "$REMOTE_DIR"
    exit 0
fi

info "Running install.sh on $REMOTE ..."
printf '\n'
sshpass -e ssh "${SSH_OPTS[@]}" "$REMOTE" "cd $REMOTE_DIR && bash install.sh $*" || fail "Remote install failed"

printf '\n'
ok "Deployed to $HOST"
printf '  \033[0;36mWeb UI:\033[0m  http://%s:8081\n' "$HOST"
printf '  \033[0;36mAPI:\033[0m     http://%s:8081/api/v1/health\n' "$HOST"
printf '  \033[0;36mSSH:\033[0m     ssh %s\n\n' "$REMOTE"
