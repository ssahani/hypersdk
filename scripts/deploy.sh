#!/usr/bin/env bash
# scripts/deploy.sh — one entry: rsync+install, sync-only, quick rebuild, systemd/HTTP check
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"

SSH_PORT="${SSH_PORT:-22}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:5092/api/v1/health}"
STRICT="${STRICT:-0}"
REMOTE_DIR="${REMOTE_DIR:-~/.virtspawn}"

info() { printf 'ℹ️  %s\n' "$*"; }
ok()   { printf '✅ %s\n' "$*"; }
warn() { printf '⚠️  %s\n' "$*"; }
die()  { printf '❌ %s\n' "$*" >&2; exit 1; }

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15 -p "$SSH_PORT")
RSYNC_RSH="ssh ${SSH_OPTS[*]}"

usage() {
    cat <<'EOF'
deploy.sh USER@HOST | USER HOST [PASSWORD] [--sync-only|--quick|--cleanup]
        [--bind ADDR] [--open-firewall] [--no-start] [--deps-only] [extra install.sh args...]

deploy.sh check [USER@HOST | USER HOST]

Auth: SSH keys/agent by default; optional PASSWORD arg or SSHPASS env → sshpass.

Examples:
  deploy.sh sus@185.165.240.5 --bind 0.0.0.0 --open-firewall
  deploy.sh sus 185.165.240.5 --quick
  SYNC_ONLY=1 deploy.sh sus@host
  deploy.sh check    deploy.sh check sus@host

Env: DEPLOY_HOST DEPLOY_USER SSH_PORT SSHPASS REMOTE_DIR HEALTH_URL STRICT SYNC_ONLY
EOF
    exit 0
}

[[ "${1:-}" == -h || "${1:-}" == --help ]] && usage

ssh_r() {
    if [[ -n "${SSHPASS:-}" ]] && command -v sshpass &>/dev/null; then
        SSHPASS="$SSHPASS" sshpass -e ssh "${SSH_OPTS[@]}" "$@"
    else
        ssh "${SSH_OPTS[@]}" "$@"
    fi
}

rsync_r() {
    if [[ -n "${SSHPASS:-}" ]] && command -v sshpass &>/dev/null; then
        SSHPASS="$SSHPASS" sshpass -e rsync -az --delete -e "$RSYNC_RSH" "$@"
    else
        rsync -az --delete -e "$RSYNC_RSH" "$@"
    fi
}

check_body() {
    EXIT_CODE=0
    unit_line() {
        local n="$1" a e
        a=$(systemctl is-active "$n" 2>/dev/null) || a="unknown"
        e=$(systemctl is-enabled "$n" 2>/dev/null) || e="unknown"
        printf '  %-28s active=%-12s enabled=%s\n' "$n" "$a" "$e"
    }
    if ! command -v systemctl &>/dev/null; then
        warn "systemctl not found — skip unit checks"
    else
        printf '\n⚙️  Systemd units\n'
        unit_line libvirtd.service
        unit_line virtspawn-daemon.service
        unit_line virtspawn-backup.timer
        local ad al
        ad=$(systemctl is-active virtspawn-daemon 2>/dev/null || true)
        al=$(systemctl is-active libvirtd 2>/dev/null || true)
        [[ "$al" == active ]] || { warn "libvirtd not active"; [[ "$STRICT" == 1 ]] && EXIT_CODE=1; }
        [[ "$al" == active ]] && ok "libvirtd active"
        [[ "$ad" == active ]] || { warn "virtspawn-daemon not active"; [[ "$STRICT" == 1 ]] && EXIT_CODE=1; }
        [[ "$ad" == active ]] && ok "virtspawn-daemon active"
    fi
    command -v journalctl &>/dev/null && printf '\n📜 Last 5 daemon log lines\n' && \
        journalctl -u virtspawn-daemon -n 5 --no-pager 2>/dev/null || warn "no journal access for virtspawn-daemon"
    printf '\n💚 HTTP %s\n' "$HEALTH_URL"
    if command -v curl &>/dev/null; then
        curl -sf --connect-timeout 3 "$HEALTH_URL" >/dev/null 2>&1 && ok "GET $HEALTH_URL" || {
            warn "cannot reach $HEALTH_URL"; [[ "$STRICT" == 1 ]] && EXIT_CODE=1; }
    else
        warn "curl missing — skip HTTP check"
    fi
    printf '\n'
    exit "$EXIT_CODE"
}

check_remote() {
    local r="$1"
    info "check @ $r"
    ssh_r "$r" env STRICT="$STRICT" HEALTH_URL="$HEALTH_URL" bash -s <<'EOS'
run() {
    EXIT_CODE=0
    unit_line() {
        local n="$1" a e
        a=$(systemctl is-active "$n" 2>/dev/null) || a="unknown"
        e=$(systemctl is-enabled "$n" 2>/dev/null) || e="unknown"
        printf '  %-28s active=%-12s enabled=%s\n' "$n" "$a" "$e"
    }
    info() { printf 'ℹ️  %s\n' "$*"; }
    ok()   { printf '✅ %s\n' "$*"; }
    warn() { printf '⚠️  %s\n' "$*"; }
    if ! command -v systemctl &>/dev/null; then warn "no systemctl"; exit 1; fi
    printf '\n⚙️  Systemd units\n'
    unit_line libvirtd.service
    unit_line virtspawn-daemon.service
    unit_line virtspawn-backup.timer
    local ad al
    ad=$(systemctl is-active virtspawn-daemon 2>/dev/null || true)
    al=$(systemctl is-active libvirtd 2>/dev/null || true)
    [[ "$al" == active ]] || warn "libvirtd not active"
    [[ "$ad" == active ]] || warn "virtspawn-daemon not active"
    [[ "$al" == active ]] && ok "libvirtd active"
    [[ "$ad" == active ]] && ok "virtspawn-daemon active"
    printf '\n📜 Last 5 daemon log lines\n'
    journalctl -u virtspawn-daemon -n 5 --no-pager 2>/dev/null || warn "no journal"
    printf '\n💚 HTTP %s\n' "$HEALTH_URL"
    command -v curl &>/dev/null && curl -sf --connect-timeout 3 "$HEALTH_URL" >/dev/null && ok "GET $HEALTH_URL" || warn "cannot reach $HEALTH_URL"
    printf '\n'
}
run
EOS
}

MODE=deploy
[[ "${1:-}" == check ]] && { MODE=check; shift; }

SKIP_INSTALL=false
QUICK=false
CLEANUP=false
BIND=""
OPEN_FW=false
NO_START=false
DEPS_ONLY=false
REST=()

parse_flags() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --sync-only) SKIP_INSTALL=true; shift ;;
            --quick) QUICK=true; shift ;;
            --cleanup) CLEANUP=true; shift ;;
            --open-firewall) OPEN_FW=true; shift ;;
            --no-start) NO_START=true; shift ;;
            --deps-only) DEPS_ONLY=true; shift ;;
            --bind) shift; BIND="${1:?}"; shift ;;
            *) REST+=("$1"); shift ;;
        esac
    done
}

if [[ "$MODE" == check ]]; then
    case $# in
        0) check_body ;;
        1) [[ "$1" == *@* ]] || die "check: pass USER@HOST or two args USER HOST"; check_remote "$1" ;;
        2) check_remote "${1}@${2}" ;;
        *) die "check: too many arguments" ;;
    esac
    exit 0
fi

[[ $# -eq 0 && -n "${DEPLOY_HOST:-}" ]] && set -- "${DEPLOY_USER:-root}" "$DEPLOY_HOST"

if [[ $# -ge 1 && "$1" == *@* ]]; then
    REMOTE="$1"; USER="${1%%@*}"; HOST="${1#*@}"; shift
    parse_flags "$@"
elif [[ $# -ge 2 ]]; then
    USER="$1"; HOST="$2"; shift 2
    [[ $# -gt 0 && "${1:-}" != -* ]] && { export SSHPASS="$1"; shift; }
    parse_flags "$@"
else
    die "need USER@HOST or USER HOST (deploy.sh --help)"
fi

REMOTE="${USER}@${HOST}"
INSTALL_ARGS=("${REST[@]}")

[[ -f "$REPO/Cargo.toml" ]] || die "run from virtspawn repo"
[[ -n "${SSHPASS:-}" ]] && ! command -v sshpass &>/dev/null && die "install sshpass for password auth"
command -v rsync &>/dev/null || die "rsync required"

[[ -n "${SSHPASS:-}" ]] && info "SSH → $REMOTE (password)" || info "SSH → $REMOTE (keys)"

ssh_r "$REMOTE" 'hostname' >/dev/null || die "cannot SSH to $REMOTE"

echo "📦 rsync → $REMOTE:$REMOTE_DIR"
ssh_r "$REMOTE" "mkdir -p $REMOTE_DIR"
rsync_r \
    --exclude='target/' --exclude='node_modules/' --exclude='.git/' --exclude='web/dist/' \
    "$REPO/" "$REMOTE:$REMOTE_DIR/" || die "rsync failed"

if [[ "${SYNC_ONLY:-0}" == 1 ]] || $SKIP_INSTALL; then
    ok "sync-only done"
    exit 0
fi

OPTS=""
[[ -n "$BIND" ]] && OPTS+=" --bind $BIND"
$OPEN_FW && OPTS+=" --open-firewall"
$NO_START && OPTS+=" --no-start"
$DEPS_ONLY && OPTS+=" --deps-only"

REMOTE_INST=""
for a in "${INSTALL_ARGS[@]}"; do REMOTE_INST+=" $(printf '%q' "$a")"; done

if $QUICK; then
    echo "⚡ quick: make release + install + restart"
    ssh_r "$REMOTE" "sudo bash -lc 'cd $REMOTE_DIR && make release web && make install && systemctl restart virtspawn-daemon'" || die "quick rebuild failed"
else
    echo "🔧 install.sh"
    ssh_r "$REMOTE" "cd $REMOTE_DIR && sudo bash install.sh${OPTS}${REMOTE_INST}" || die "install failed"
fi

$CLEANUP && { echo "🧹 cleanup $REMOTE_DIR"; ssh_r "$REMOTE" "rm -rf $REMOTE_DIR"; }

echo "🔍 verify"
sleep 1
check_remote "$REMOTE" || true

echo ""
echo "════════════════════════════════════════"
echo "✅ done  🌐 http://${HOST}:5092  💚 http://${HOST}:5092/api/v1/health"
echo "🔁 ./scripts/deploy.sh ${USER}@${HOST} --quick"
echo "════════════════════════════════════════"
