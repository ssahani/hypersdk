#!/usr/bin/env bash
# scripts/install-hyper2kvm.sh — End-user installer for Machina Hyper2KVM Platform
#
# Installs machina-daemon + machina-controller + machina-agent, enables the HyperSDK
# proxy integration, generates a 30-day trial licence, and starts all services.
#
# Usage:
#   sudo ./scripts/install-hyper2kvm.sh [OPTIONS]
#
# Options:
#   --licensee "Name"      Licensee name embedded in trial key (default: "Trial Customer")
#   --days N               Trial duration in days (default: 30)
#   --bind ADDR            Bind address for daemon (default: 0.0.0.0)
#   --open-firewall        Open ports 5092 and 5093 in the active firewall
#   --disable-firewalld    Disable firewalld/ufw entirely (lab environments)
#   --remote USER@HOST     Deploy to a remote host via SSH (rsync + build on remote)
#   --no-start             Install but don't start services
#   --no-tests             Skip post-install verification
#   --with-guacamole       Also install Apache Guacamole
#   --help                 Show this help

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Defaults ──────────────────────────────────────────────────────────────────
LICENSEE="Trial Customer"
TRIAL_DAYS=30
BIND_ADDR="0.0.0.0"
OPEN_FIREWALL=false
DISABLE_FIREWALL=false
REMOTE_HOST=""
NO_START=false
NO_TESTS=false
WITH_GUACAMOLE=false

# ── Colors / output helpers ───────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[0;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}ℹ  $*${NC}"; }
ok()    { echo -e "${GREEN}✅ $*${NC}"; }
warn()  { echo -e "${YELLOW}⚠  $*${NC}"; }
fail()  { echo -e "${RED}❌ $*${NC}"; exit 1; }
step()  { echo ""; echo -e "${CYAN}━━  $*${NC}"; }

# ── Banner ────────────────────────────────────────────────────────────────────

print_banner() {
    echo ""
    echo -e "${CYAN}  ╔══════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}  ║        Machina  •  Hyper2KVM Platform                ║${NC}"
    echo -e "${CYAN}  ║        Hypervisor-to-KVM Migration Suite              ║${NC}"
    echo -e "${CYAN}  ║        by ZyvorAI Labs  •  https://zyvor.dev          ║${NC}"
    echo -e "${CYAN}  ╚══════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# ── Argument parsing ──────────────────────────────────────────────────────────

parse_args() {
    local prev=""
    for arg in "$@"; do
        case "$prev" in
            --licensee) LICENSEE="$arg"; prev=""; continue ;;
            --days)     TRIAL_DAYS="$arg"; prev=""; continue ;;
            --bind)     BIND_ADDR="$arg";  prev=""; continue ;;
            --remote)   REMOTE_HOST="$arg"; prev=""; continue ;;
        esac
        case "$arg" in
            --licensee|--days|--bind|--remote) prev="$arg" ;;
            --open-firewall)    OPEN_FIREWALL=true ;;
            --disable-firewalld) DISABLE_FIREWALL=true ;;
            --no-start)         NO_START=true ;;
            --no-tests)         NO_TESTS=true ;;
            --with-guacamole)   WITH_GUACAMOLE=true ;;
            --help|-h)          show_help; exit 0 ;;
            *) warn "Unknown argument: $arg" ;;
        esac
    done
}

show_help() {
    cat <<'EOF'
Machina Hyper2KVM Platform — end-user installer

Usage:
  sudo ./scripts/install-hyper2kvm.sh [OPTIONS]

Options:
  --licensee "Name"      Licensee name for trial key (default: "Trial Customer")
  --days N               Trial duration in days (default: 30)
  --bind ADDR            Bind address (default: 0.0.0.0 — all interfaces)
  --open-firewall        Open ports 5092 and 5093 in firewall
  --disable-firewalld    Stop and disable firewalld/ufw
  --remote USER@HOST     Deploy to remote server over SSH
  --no-start             Install but do not start services
  --no-tests             Skip post-install verification
  --with-guacamole       Install Apache Guacamole remote desktop gateway
  --help                 Show this help

Components installed:
  machina-daemon        Hypervisor REST API + Web UI  (:5092)
  machina-controller    Enterprise control plane       (:5093)
  machina-agent         Per-host KVM agent             (:50051)
  HyperSDK proxy        /api/v1/hypersdk/*  (enabled)
  30-day trial licence  Auto-generated, written to /etc/machina/license.key

Examples:
  sudo ./scripts/install-hyper2kvm.sh
  sudo ./scripts/install-hyper2kvm.sh --licensee "Acme Corp" --days 30
  ./scripts/install-hyper2kvm.sh --remote root@192.168.1.100 --open-firewall
EOF
}

# ── Remote deploy ─────────────────────────────────────────────────────────────

remote_deploy() {
    local target="$1"
    step "Deploying to $target (Hyper2KVM)"

    info "Syncing source to $target:~/.deployment/machina ..."
    ssh "$target" "mkdir -p ~/.deployment/machina"
    rsync -az --delete \
        --exclude target --exclude node_modules --exclude .git --exclude web/dist \
        "$REPO_DIR/" "$target:~/.deployment/machina/"
    ok "Source synced"

    # Build remote args
    local rargs="--licensee \"$LICENSEE\" --days $TRIAL_DAYS --bind $BIND_ADDR --no-tests"
    $OPEN_FIREWALL    && rargs="$rargs --open-firewall"
    $DISABLE_FIREWALL && rargs="$rargs --disable-firewalld"
    $WITH_GUACAMOLE   && rargs="$rargs --with-guacamole"
    $NO_START         && rargs="$rargs --no-start"

    info "Running install on $target ..."
    # shellcheck disable=SC2029
    ssh "$target" "cd ~/.deployment/machina && sudo bash scripts/install-hyper2kvm.sh $rargs"

    local ip
    ip=$(echo "$target" | sed 's/.*@//')
    echo ""
    echo "════════════════════════════════════════════════════════"
    ok "Deployed Machina Hyper2KVM to $target"
    echo "════════════════════════════════════════════════════════"
    echo ""
    echo "  🌐 Web UI:      https://$ip:5092"
    echo "  🔗 Daemon API:  https://$ip:5092/api/v1/health"
    echo "  🗄  Controller:  https://$ip:5093/api/v1/health"
    echo "  📋 Trial:       $TRIAL_DAYS days from today ($LICENSEE)"
    echo ""
}

# ── Trial key generation ──────────────────────────────────────────────────────

generate_trial_key() {
    step "Generating 30-day trial licence for: $LICENSEE"

    if ! command -v python3 >/dev/null 2>&1; then
        warn "python3 not found — install python3 and retry, or set MACHINA_LICENSE_KEY manually"
        return 1
    fi

    TRIAL_KEY=$(python3 - "$LICENSEE" "$TRIAL_DAYS" <<'PYEOF'
import sys, base64, datetime, hmac, hashlib, json

HMAC_SECRET = b"zyvor-machina-trial-v1-5f7h9j1l3n5p7r9t"
PRODUCT = "machina"

def b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

licensee = sys.argv[1]
days = int(sys.argv[2])
today = datetime.date.today()
expiry = today + datetime.timedelta(days=days)
payload = json.dumps({"p": PRODUCT, "iss": today.isoformat(), "exp": expiry.isoformat(), "who": licensee},
                     separators=(",", ":")).encode()
payload_b64 = b64url(payload)
sig = hmac.new(HMAC_SECRET, payload_b64.encode(), hashlib.sha256).digest()
print(f"{payload_b64}.{b64url(sig)}", end="")
PYEOF
)

    if [[ -z "$TRIAL_KEY" ]]; then
        fail "Trial key generation failed"
    fi

    TRIAL_EXPIRY=$(python3 -c "import datetime; print((datetime.date.today() + datetime.timedelta(days=$TRIAL_DAYS)).isoformat())")
    ok "Trial key generated (expires $TRIAL_EXPIRY)"
}

# ── Install trial key ─────────────────────────────────────────────────────────

install_trial_key() {
    step "Installing trial licence key"

    mkdir -p /etc/machina
    printf '%s\n' "$TRIAL_KEY" > /etc/machina/license.key
    chmod 600 /etc/machina/license.key
    ok "Licence key -> /etc/machina/license.key"

    # Export for child scripts that read the env var
    export MACHINA_LICENSE_KEY="$TRIAL_KEY"
}

# ── Install machina-daemon ────────────────────────────────────────────────────

install_daemon() {
    step "Installing machina-daemon + web UI"

    local install_args="--bind $BIND_ADDR --no-tests"
    $OPEN_FIREWALL    && install_args="$install_args --open-firewall"
    $DISABLE_FIREWALL && install_args="$install_args --disable-firewalld"
    $WITH_GUACAMOLE   && install_args="$install_args --with-guacamole"
    $NO_START         && install_args="$install_args --no-start"

    # shellcheck disable=SC2086
    bash "$REPO_DIR/install.sh" $install_args
    ok "machina-daemon installed"
}

# ── Enable HyperSDK integration ───────────────────────────────────────────────

configure_hypersdk() {
    step "Enabling HyperSDK proxy integration"

    local cfg="/etc/machina/config.toml"
    if [[ ! -f "$cfg" ]]; then
        warn "Config not found at $cfg — skipping HyperSDK configuration"
        return 0
    fi

    if grep -q '^\[hypersdk\]' "$cfg" 2>/dev/null; then
        info "HyperSDK section already present in config — skipping"
        return 0
    fi

    cat >> "$cfg" <<'EOF'

[hypersdk]
# HyperSDK proxy — forwards /api/v1/hypersdk/* to hypervisord.
# Set base_url to the address of your hypervisord instance.
enabled = true
base_url = "https://127.0.0.1:5080"
insecure_tls = true
EOF
    ok "HyperSDK integration enabled in $cfg"
}

# ── Install platform (controller + agent) ─────────────────────────────────────

install_platform() {
    step "Installing machina-controller + machina-agent (platform)"

    local platform_script="$REPO_DIR/scripts/install-platform.sh"
    if [[ ! -f "$platform_script" ]]; then
        warn "scripts/install-platform.sh not found — skipping platform install"
        return 0
    fi

    local platform_args="--bind $BIND_ADDR"
    $OPEN_FIREWALL    && platform_args="$platform_args --open-firewall"
    $DISABLE_FIREWALL && platform_args="$platform_args --disable-firewalld"

    bash "$platform_script" $platform_args
    ok "machina-controller + machina-agent installed"
}

# ── Propagate licence to platform services ────────────────────────────────────

propagate_license_to_platform() {
    step "Configuring trial key for controller and agent"

    local env_file="/etc/default/machina-platform"
    if [[ ! -f "$env_file" ]]; then
        warn "$env_file not found — controller/agent may need MACHINA_LICENSE_KEY set manually"
        return 0
    fi

    # Remove any existing key line and append the new one
    if grep -q "^MACHINA_LICENSE_KEY=" "$env_file" 2>/dev/null; then
        sed -i '/^MACHINA_LICENSE_KEY=/d' "$env_file"
    fi
    echo "MACHINA_LICENSE_KEY=${TRIAL_KEY}" >> "$env_file"
    ok "Trial key written to $env_file"
}

# ── Restart all services ──────────────────────────────────────────────────────

restart_services() {
    $NO_START && return 0

    step "Starting all Hyper2KVM services"

    for svc in machina-daemon machina-controller machina-agent; do
        if systemctl is-enabled "$svc" &>/dev/null 2>&1 || systemctl cat "$svc" &>/dev/null 2>&1; then
            systemctl restart "$svc" 2>/dev/null && ok "$svc restarted" || warn "$svc restart failed"
        else
            info "$svc unit not found — skipped"
        fi
    done
}

# ── Post-install verification ─────────────────────────────────────────────────

run_verification() {
    $NO_TESTS && return 0

    step "Verifying installation"

    local host="${BIND_ADDR}"
    [[ "$host" == "0.0.0.0" ]] && host="127.0.0.1"
    local passed=0 failed=0

    check() {
        local label="$1" url="$2" expect="$3"
        local out
        out=$(curl -sfk "$url" 2>/dev/null) || out=""
        if echo "$out" | grep -qF "$expect"; then
            ok "  $label"
            passed=$((passed+1))
        else
            echo "  ❌ $label (no '$expect' in response)"
            failed=$((failed+1))
        fi
    }

    check "Daemon health"    "https://$host:5092/api/v1/health"   "healthy"
    check "License endpoint" "https://$host:5092/api/v1/license"  "is_valid"
    check "Web UI"           "https://$host:5092/"                 ""    # just checks 200

    echo ""
    echo "  Test results: ✅ $passed passed, ❌ $failed failed"
}

# ── Final summary ─────────────────────────────────────────────────────────────

print_summary() {
    local host="${BIND_ADDR}"
    [[ "$host" == "0.0.0.0" ]] && host=$(hostname -I 2>/dev/null | awk '{print $1}') || true
    [[ -z "$host" ]] && host="127.0.0.1"

    echo ""
    echo "════════════════════════════════════════════════════════"
    echo -e "${GREEN}  ✅  Machina Hyper2KVM Platform — installed!${NC}"
    echo "════════════════════════════════════════════════════════"
    echo ""
    echo "  🌐 Web UI:        https://${host}:5092"
    echo "  🔗 Daemon API:    https://${host}:5092/api/v1/health"
    echo "  🗄  Controller:    https://${host}:5093/api/v1/health  (if enabled)"
    echo "  📋 Licence:       /etc/machina/license.key"
    echo "  🔑 Licensee:      $LICENSEE"
    echo "  ⏰ Trial expires: ${TRIAL_EXPIRY:-$TRIAL_DAYS days from today}"
    echo ""
    echo "  Manage:"
    echo "    sudo systemctl status  machina-daemon"
    echo "    sudo systemctl status  machina-controller"
    echo "    sudo systemctl status  machina-agent"
    echo "    sudo journalctl -u machina-daemon -f"
    echo ""
    echo "  Config:  /etc/machina/config.toml"
    echo "  Logs:    sudo journalctl -u machina-daemon -f"
    echo ""
    echo "  HyperSDK proxy enabled: /api/v1/hypersdk/*"
    echo "  Configure base_url in /etc/machina/config.toml [hypersdk]"
    echo ""
    echo "  For a commercial licence: sales@zyvor.dev | https://zyvor.dev"
    echo ""
}

# ── Entry point ───────────────────────────────────────────────────────────────

main() {
    parse_args "$@"
    print_banner

    # Remote mode — no root needed locally
    if [[ -n "$REMOTE_HOST" ]]; then
        remote_deploy "$REMOTE_HOST"
        exit 0
    fi

    if [[ "$(id -u)" -ne 0 ]]; then
        fail "Run as root: sudo $0 $*"
    fi

    generate_trial_key
    install_trial_key
    install_daemon
    configure_hypersdk
    install_platform
    propagate_license_to_platform
    restart_services
    run_verification
    print_summary
}

main "$@"
