#!/usr/bin/env bash
# scripts/deploy-remote.sh — rsync sources to remote, compile & install ONLY on remote
#
# Nothing is built on your laptop: install.sh runs cargo/npm on the SSH host (--quick uses
# make release web there). Locals only need rsync + ssh (no Rust/Node locally).
set -euo pipefail

# Indexed array required before REST+= / "${REST[@]}" under `set -u` (bash 5.x empty-array quirk).
declare -a REST=()

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"

SSH_PORT="${SSH_PORT:-22}"
HEALTH_URL="${HEALTH_URL:-https://127.0.0.1:5092/api/v1/health}"
STRICT="${STRICT:-0}"
# Default matches VM-style layout: rsync here → build on server → install to /usr/local + systemd
REMOTE_DIR="${REMOTE_DIR:-~/.deployment/machina}"

# ── Terminal styling (NO_COLOR + non-TTY safe) ────────────────────────────────
if [[ -t 1 ]] && [[ -z "${NO_COLOR:-}" ]]; then
    BOLD=$'\033[1m'
    DIM=$'\033[2m'
    RESET=$'\033[0m'
    CYAN=$'\033[36m'
    GREEN=$'\033[32m'
    YELLOW=$'\033[33m'
    MAGENTA=$'\033[35m'
    BLUE=$'\033[34m'
else
    BOLD='' DIM='' RESET='' CYAN='' GREEN='' YELLOW='' MAGENTA='' BLUE=''
fi

_bar72() { printf '%s' '────────────────────────────────────────────────────────────────────────'; }

info() { printf '%bℹ️  %s%b\n' "$BLUE" "$*" "$RESET"; }
ok()   { printf '%b✅ %s%b\n' "$GREEN" "$*" "$RESET"; }
warn() { printf '%b⚠️  %s%b\n' "$YELLOW" "$*" "$RESET"; }
die()  { printf '%b❌ %s%b\n' "$MAGENTA" "$*" "$RESET" >&2; exit 1; }

hr() { printf '\n%b%s%b\n' "$DIM" "$(_bar72)" "$RESET"; }

# Usage: phase step total "Title" "optional subtitle"
phase() {
    local step="$1" total="$2" title="$3"
    local sub="${4:-}"
    printf '\n'
    printf '%b╭%s╮%b\n' "$CYAN" "$(_bar72)" "$RESET"
    printf '%b│%b  %s/%s  %b%s%b' "$CYAN" "$DIM" "$step" "$total" "$BOLD" "$title" "$RESET"
    [[ -n "$sub" ]] && printf '\n%b│%b    %s%b' "$CYAN" "$DIM" "$sub" "$RESET"
    printf '\n'
    printf '%b╰%s╯%b\n' "$CYAN" "$(_bar72)" "$RESET"
}

banner_deploy() {
    local host="$1" user="$2" rdir="$3" mode="$4"
    printf '\n'
    printf '%b%s%b\n' "$CYAN" "$(_bar72)" "$RESET"
    printf '%b  🚀 Machina remote deploy%b\n' "$BOLD$GREEN" "$RESET"
    printf '%b%s%b\n' "$DIM" "$(_bar72)" "$RESET"
    printf '  %-14s %b%s@%s%b\n' "SSH target" "$BOLD" "$user" "$host" "$RESET"
    printf '  %-14s %s\n' "Remote tree" "$rdir"
    printf '  %-14s %b%s%b\n' "Plan" "$YELLOW" "$mode" "$RESET"
    printf '  %-14s %s\n' "Health check" "${HEALTH_URL}"
    printf '%b%s%b\n\n' "$CYAN" "$(_bar72)" "$RESET"
}

tip() { printf '%b💡 %s%b\n' "$DIM" "$*" "$RESET"; }

elapsed_fmt() {
    local s="$1"
    local m=$((s / 60)) r=$((s % 60))
    ((m > 0)) && printf '%dm ' "$m"
    printf '%ds' "$r"
}

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15 -p "$SSH_PORT")
RSYNC_RSH="ssh ${SSH_OPTS[*]}"

usage() {
    cat <<'EOF'
deploy-remote.sh USER@HOST | USER HOST [PASSWORD] [--sync-only|--quick|--cleanup]
        [--remote-build|--remote-check] [--bind ADDR] [--open-firewall] [--no-start] [--deps-only] [extra install.sh args...]

deploy-remote.sh check [USER@HOST | USER HOST]

Flow: rsync → ~/.deployment/machina (REMOTE_DIR) → build on server → install → systemd.
Full install: install.sh enables + restarts the daemon (--no-start skips). Post-install curl/API verification is skipped on the remote (--no-tests). install.sh also ensures mkosi (v16+): distro package if recent, else pipx from GitHub, else optional git clone (MACHINA_MKOSI_FROM_CLONE=1), else /opt/mkosi-venv; host build tools (bubblewrap, dosfstools, …) best-effort. Default disk workflow in the Create VM UI.
Quick: make install then daemon-reload + try-restart (only restarts if machina-daemon was active).
Open the UI at https://HOST:5092 (install.sh generates a self-signed cert; replace with your CA for browsers).

--remote-build   After rsync+chown, run `make release` on the SSH host only (no sudo install.sh).
                 Use this to surface Rust / pam-sys / Axum compile errors quickly. Requires Rust + build deps on the server (e.g. after `sudo install.sh --deps-only` once).
--remote-check   Same but `make check` (faster compile check).

Auth: SSH keys/agent by default; optional PASSWORD arg or SSHPASS env → sshpass.

Examples:
  deploy-remote.sh sus@185.165.240.5 --bind 0.0.0.0 --open-firewall
  deploy-remote.sh sus 185.165.240.5 --quick
  deploy-remote.sh sus@host --remote-check    # fast compile smoke after rsync
  deploy-remote.sh sus@host --remote-build   # full release build on server, then exit
  # Full install passes --no-tests to install.sh (no post-install curl suite on the server).
  (Order is always USER then HOST — not HOST USER.)
  SYNC_ONLY=1 deploy-remote.sh sus@host
  deploy-remote.sh check    deploy-remote.sh check sus@host

Env: DEPLOY_HOST DEPLOY_USER SSH_PORT SSHPASS REMOTE_DIR HEALTH_URL STRICT SYNC_ONLY

After each rsync, the script runs sudo chown on the deploy tree so interrupted
sudo builds cannot leave root-owned target/ (cargo EACCES on --quick).

Output uses ANSI colors when stdout is a TTY. Set NO_COLOR=1 to disable.
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
    printf '\n%b  🩺 Local machina health snapshot%b\n' "$BOLD$CYAN" "$RESET"
    hr
    unit_line() {
        local n="$1" a e
        a=$(systemctl is-active "$n" 2>/dev/null) || a="unknown"
        e=$(systemctl is-enabled "$n" 2>/dev/null) || e="unknown"
        printf '  %-28s active=%-12s enabled=%s\n' "$n" "$a" "$e"
    }
    if ! command -v systemctl &>/dev/null; then
        warn "systemctl not found — skip unit checks"
    else
        printf '\n%b⚙️  Systemd units%b\n' "$BOLD" "$RESET"
        unit_line libvirtd.service
        unit_line machina-daemon.service
        unit_line machina-backup.timer
        local ad al
        ad=$(systemctl is-active machina-daemon 2>/dev/null || true)
        al=$(systemctl is-active libvirtd 2>/dev/null || true)
        [[ "$al" == active ]] || { warn "libvirtd not active"; [[ "$STRICT" == 1 ]] && EXIT_CODE=1; }
        [[ "$al" == active ]] && ok "libvirtd active"
        [[ "$ad" == active ]] || { warn "machina-daemon not active"; [[ "$STRICT" == 1 ]] && EXIT_CODE=1; }
        [[ "$ad" == active ]] && ok "machina-daemon active"
    fi
    if command -v systemctl &>/dev/null; then
        printf '\n%b📋 machina-daemon — systemctl status%b\n' "$BOLD" "$RESET"
        systemctl status machina-daemon --no-pager 2>/dev/null || warn "cannot read machina-daemon status"
        printf '\n%b📋 libvirtd — systemctl status%b\n' "$BOLD" "$RESET"
        systemctl status libvirtd --no-pager 2>/dev/null || warn "cannot read libvirtd status"
    fi
    printf '\n%b💚 API health%b  %s\n' "$BOLD$GREEN" "$RESET" "$HEALTH_URL"
    if command -v curl &>/dev/null; then
        curl -sfk --connect-timeout 3 "$HEALTH_URL" >/dev/null 2>&1 && ok "GET $HEALTH_URL" || {
            warn "cannot reach $HEALTH_URL"; [[ "$STRICT" == 1 ]] && EXIT_CODE=1; }
    else
        warn "curl missing — skip HTTP check"
    fi
    printf '\n'
    exit "$EXIT_CODE"
}

check_remote() {
    local r="$1"
    printf '\n%b  🩺 Remote health check%b\n' "$BOLD$CYAN" "$RESET"
    hr
    info "SSH target → $r"
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
    unit_line machina-daemon.service
    unit_line machina-backup.timer
    local ad al
    ad=$(systemctl is-active machina-daemon 2>/dev/null || true)
    al=$(systemctl is-active libvirtd 2>/dev/null || true)
    [[ "$al" == active ]] || warn "libvirtd not active"
    [[ "$ad" == active ]] || warn "machina-daemon not active"
    [[ "$al" == active ]] && ok "libvirtd active"
    [[ "$ad" == active ]] && ok "machina-daemon active"
    printf '\n📋 systemctl status machina-daemon\n'
    systemctl status machina-daemon --no-pager 2>/dev/null || warn "cannot read machina-daemon status"
    printf '\n📋 systemctl status libvirtd\n'
    systemctl status libvirtd --no-pager 2>/dev/null || warn "cannot read libvirtd status"
    printf '\n💚 HTTPS %s\n' "$HEALTH_URL"
    command -v curl &>/dev/null && curl -sfk --connect-timeout 3 "$HEALTH_URL" >/dev/null && ok "GET $HEALTH_URL" || warn "cannot reach $HEALTH_URL"
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
REMOTE_BUILD=false
REMOTE_CHECK=false

parse_flags() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --sync-only) SKIP_INSTALL=true; shift ;;
            --quick) QUICK=true; shift ;;
            --cleanup) CLEANUP=true; shift ;;
            --open-firewall) OPEN_FW=true; shift ;;
            --no-start) NO_START=true; shift ;;
            --deps-only) DEPS_ONLY=true; shift ;;
            --remote-build) REMOTE_BUILD=true; SKIP_INSTALL=true; shift ;;
            --remote-check) REMOTE_CHECK=true; SKIP_INSTALL=true; shift ;;
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
    # Common mistake: HOST USER (e.g. IP first). We only auto-fix when $1 looks like IPv4 and $2 does not.
    if [[ "$1" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] && [[ ! "$2" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
        warn "first token looks like an IPv4 address — expected USER HOST, not HOST USER. Using «$2» @ «$1»."
        USER="$2"
        HOST="$1"
    else
        USER="$1"
        HOST="$2"
    fi
    shift 2
    [[ $# -gt 0 && "${1:-}" != -* ]] && { export SSHPASS="$1"; shift; }
    parse_flags "$@"
else
    die "need USER@HOST or USER HOST (deploy-remote.sh --help)"
fi

REMOTE="${USER}@${HOST}"
declare -a INSTALL_ARGS=()
if ((${#REST[@]} > 0)); then
    INSTALL_ARGS=("${REST[@]}")
fi

[[ -f "$REPO/Cargo.toml" ]] || die "run from machina repo root (sources are rsync'd — not built here)"
[[ -n "${SSHPASS:-}" ]] && ! command -v sshpass &>/dev/null && die "install sshpass for password auth"
command -v rsync &>/dev/null || die "rsync required"

[[ -n "${SSHPASS:-}" ]] && info "SSH auth: password (SSHPASS / sshpass)" || info "SSH auth: keys or agent"

REMOTE_HOSTNAME="$(ssh_r "$REMOTE" 'hostname')" || die "cannot SSH to $REMOTE"
ok "Connected — remote hostname: $REMOTE_HOSTNAME"

MODE_LABEL="Full install — sudo install.sh (deps, Rust, npm, systemd)"
if $REMOTE_CHECK; then MODE_LABEL="Compile check — make check (no install)"; fi
if $REMOTE_BUILD; then MODE_LABEL="Compile — make release (no install)"; fi
if [[ "${SYNC_ONLY:-0}" == 1 ]] || ($SKIP_INSTALL && ! $REMOTE_BUILD && ! $REMOTE_CHECK); then
    MODE_LABEL="Sync only — rsync sources + ownership fix"
fi
if $QUICK; then MODE_LABEL="Quick — make release web + install + try-restart"; fi

TOTAL_STEPS=4
if $REMOTE_BUILD || $REMOTE_CHECK; then TOTAL_STEPS=3
elif [[ "${SYNC_ONLY:-0}" == 1 ]] || ($SKIP_INSTALL && ! $REMOTE_BUILD && ! $REMOTE_CHECK); then TOTAL_STEPS=2
fi

OPTS_LINE=""
[[ -n "$BIND" ]] && OPTS_LINE+="--bind $BIND  "
$OPEN_FW && OPTS_LINE+="--open-firewall  "
$NO_START && OPTS_LINE+="--no-start  "
$DEPS_ONLY && OPTS_LINE+="--deps-only  "
$CLEANUP && OPTS_LINE+="cleanup deploy dir after  "

DEPLOY_T0=$SECONDS
banner_deploy "$HOST" "$USER" "$REMOTE_DIR" "$MODE_LABEL"
[[ -n "${OPTS_LINE// /}" ]] && tip "Extra install.sh flags: ${OPTS_LINE%  }"

phase 1 "$TOTAL_STEPS" "Synchronize sources to remote" "rsync · excludes target/, node_modules/, .git/, web/dist/"
ssh_r "$REMOTE" "mkdir -p $REMOTE_DIR"
rsync_r \
    --exclude='target/' --exclude='node_modules/' --exclude='.git/' --exclude='web/dist/' \
    "$REPO/" "$REMOTE:$REMOTE_DIR/" || die "rsync failed"
ok "Sources synced → ${REMOTE}:${REMOTE_DIR}"

# If a previous run left root-owned files under the tree (e.g. interrupted sudo), cargo fails with EACCES.
phase 2 "$TOTAL_STEPS" "Ensure deploy tree is writable" "sudo chown → SSH user (idempotent)"
ssh_r "$REMOTE" "cd $REMOTE_DIR && sudo chown -R \"\$(id -un):\$(id -gn)\" ." || warn "chown deploy tree failed (non-fatal if you are not sudo-capable)"

if $REMOTE_BUILD || $REMOTE_CHECK; then
    mk_target=release
    $REMOTE_CHECK && mk_target=check
    phase 3 "$TOTAL_STEPS" "Compile on remote (make ${mk_target})" "no install.sh — use full deploy to install binaries"
    ssh_r "$REMOTE" "bash -s" "$REMOTE_DIR" "$mk_target" <<'EOS' || die "remote compile failed"
set -euo pipefail
REMOTE_DIR="${1:?}"
REMOTE_MAKE_TARGET="${2:?}"
cd "$REMOTE_DIR" || exit 1
export PATH="${HOME}/.cargo/bin:/usr/local/cargo/bin:/usr/local/bin:/usr/bin:${PATH}"
if ! command -v cargo >/dev/null 2>&1; then
    echo "cargo not on PATH — install Rust + clang first (e.g. sudo ./install.sh --deps-only on the server)." >&2
    exit 1
fi
if [ -z "${LIBCLANG_PATH:-}" ]; then
    if command -v llvm-config >/dev/null 2>&1; then
        _maj="$(llvm-config --version 2>/dev/null | cut -d. -f1 || true)"
        if [ -n "$_maj" ] && [ -d "/usr/lib64/llvm${_maj}/lib64" ]; then
            export LIBCLANG_PATH="/usr/lib64/llvm${_maj}/lib64"
        fi
    fi
    if [ -z "${LIBCLANG_PATH:-}" ] && [ -d /usr/lib64/llvm20/lib64 ]; then
        export LIBCLANG_PATH=/usr/lib64/llvm20/lib64
    fi
fi
[ -n "${LIBCLANG_PATH:-}" ] && printf 'ℹ  LIBCLANG_PATH=%s\n' "$LIBCLANG_PATH"
make "$REMOTE_MAKE_TARGET"
EOS
    ok "Remote compile finished — run without --remote-build/--remote-check to install"
    hr
    printf '%b  ✨ Finished in %s%b\n' "$GREEN" "$(elapsed_fmt $((SECONDS - DEPLOY_T0)))" "$RESET"
    tip "Next: ./scripts/deploy-remote.sh ${USER}@${HOST}   # full install on same tree"
    exit 0
fi

if [[ "${SYNC_ONLY:-0}" == 1 ]] || $SKIP_INSTALL; then
    hr
    printf '%b  ✨ Sync finished in %s%b\n' "$GREEN" "$(elapsed_fmt $((SECONDS - DEPLOY_T0)))" "$RESET"
    tip "Sources live on the server under ${REMOTE_DIR} — run full deploy when ready."
    exit 0
fi

OPTS=" --no-tests"
[[ -n "$BIND" ]] && OPTS+=" --bind $BIND"
$OPEN_FW && OPTS+=" --open-firewall"
$NO_START && OPTS+=" --no-start"
$DEPS_ONLY && OPTS+=" --deps-only"

REMOTE_INST=""
if ((${#INSTALL_ARGS[@]} > 0)); then
    for a in "${INSTALL_ARGS[@]}"; do REMOTE_INST+=" $(printf '%q' "$a")"; done
fi

if $QUICK; then
    phase 3 "$TOTAL_STEPS" "Build & install (quick path)" "make release web && sudo make install · cargo stays on user PATH"
    # Build as SSH user (rustup cargo on PATH); only `make install` needs root (install + systemctl).
    # Do not wrap `make release` in sudo — secure_path often omits cargo.
    ssh_r "$REMOTE" "cd $REMOTE_DIR && make release web && sudo make install" || die "quick build failed"
    phase 4 "$TOTAL_STEPS" "Reload systemd & try-restart machina-daemon" "daemon-reload — restarts only if the unit was already active"
    ssh_r "$REMOTE" "sudo bash -lc 'systemctl daemon-reload && systemctl try-restart machina-daemon'" || die "service reload failed"
else
    phase 3 "$TOTAL_STEPS" "Run installer on remote" "sudo install.sh — tooling, build, unit files, optional firewall"
    ssh_r "$REMOTE" "cd $REMOTE_DIR && sudo bash install.sh${OPTS}${REMOTE_INST}" || die "install failed"
fi

phase 4 "$TOTAL_STEPS" "Service snapshot" "machina-daemon + libvirtd status"
ssh_r "$REMOTE" "bash -lc '
for svc in machina-daemon libvirtd; do
  st=\$(systemctl is-active \$svc 2>/dev/null || echo unknown)
  if [ \"\$st\" = active ]; then
    echo \"✅ \$svc: running\"
  else
    echo \"⚠️  \$svc: \$st\"
  fi
  systemctl status \$svc --no-pager || true
  echo
done
'" || warn "service status check failed"

if $CLEANUP; then
    warn "Removing remote deploy tree $REMOTE_DIR"
    ssh_r "$REMOTE" "rm -rf $REMOTE_DIR" || warn "cleanup failed"
fi

hr
info "Post-flight verification (health endpoint + systemd)"
sleep 1
check_remote "$REMOTE" || true

ELAPSED=$((SECONDS - DEPLOY_T0))
hr
printf '\n'
printf '%b╭%s╮%b\n' "$GREEN" "$(_bar72)" "$RESET"
printf '%b│%b  %bDeploy complete%b  ·  %s\n' "$GREEN" "$RESET" "$BOLD" "$RESET" "$(elapsed_fmt "$ELAPSED")"
printf '%b│%b\n' "$GREEN" "$RESET"
printf '%b│%b  %-18s %s\n' "$GREEN" "$RESET" "Web UI" "https://${HOST}:5092"
printf '%b│%b  %-18s %s\n' "$GREEN" "$RESET" "Health API" "https://${HOST}:5092/api/v1/health"
printf '%b│%b\n' "$GREEN" "$RESET"
printf '%b│%b  %s%b\n' "$GREEN" "$DIM" "Next iteration (incremental rebuild):" "$RESET"
printf '%b│%b    ./scripts/deploy-remote.sh %s@%s --quick\n' "$GREEN" "$RESET" "$USER" "$HOST"
printf '%b╰%s╯%b\n' "$GREEN" "$(_bar72)" "$RESET"
printf '\n'
tip "Trust the browser once for the self-signed TLS cert, or terminate TLS upstream."
printf '\n'
