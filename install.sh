#!/bin/bash
# virtspawn - Automated installer
# Installs all dependencies, builds from source, and starts the daemon.
# Supports Fedora/RHEL and Ubuntu/Debian.
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/ssahani/-virtspawn/main/install.sh | bash
#   # or
#   ./install.sh
#
# Options:
#   --uninstall    Remove virtspawn and stop the service
#   --deps-only    Only install dependencies, don't build
#   --no-start     Build and install but don't start the daemon

set -eo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

REPO_URL="https://github.com/ssahani/-virtspawn.git"
INSTALL_DIR="/opt/virtspawn"
LOG_FILE="/tmp/virtspawn-install-$(date +%Y%m%d-%H%M%S).log"

info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail()  { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }
step()  { echo -e "\n${CYAN}${BOLD}==> $*${NC}"; }

log_cmd() {
    "$@" >> "$LOG_FILE" 2>&1
}

# ── Detect OS ──────────────────────────────────────────────────────────

detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_ID="$ID"
        OS_VERSION="${VERSION_ID:-unknown}"
        OS_NAME="${PRETTY_NAME:-$ID}"
    else
        fail "Cannot detect OS. /etc/os-release not found."
    fi

    case "$OS_ID" in
        fedora|rhel|centos|rocky|alma)
            PKG_MANAGER="dnf"
            OS_FAMILY="fedora"
            ;;
        ubuntu|debian|linuxmint|pop)
            PKG_MANAGER="apt"
            OS_FAMILY="debian"
            ;;
        *)
            fail "Unsupported OS: $OS_ID. Supported: Fedora, RHEL, Ubuntu, Debian."
            ;;
    esac

    info "Detected: $OS_NAME ($OS_FAMILY)"
}

# ── Check prerequisites ───────────────────────────────────────────────

check_root() {
    if [ "$(id -u)" -ne 0 ]; then
        fail "This script must be run as root. Use: sudo $0"
    fi
}

check_arch() {
    ARCH=$(uname -m)
    if [ "$ARCH" != "x86_64" ] && [ "$ARCH" != "aarch64" ]; then
        warn "Untested architecture: $ARCH. Proceeding anyway."
    fi
}

# ── Install system dependencies ───────────────────────────────────────

install_deps_fedora() {
    step "Installing system dependencies (Fedora/RHEL)"

    info "Updating package cache..."
    log_cmd $PKG_MANAGER makecache -q || true

    local packages=(
        # Build tools
        gcc gcc-c++ make pkg-config
        # Libvirt
        libvirt-devel libvirt-daemon-kvm qemu-kvm virt-install
        # Node.js
        nodejs npm
        # Utilities
        git curl
    )

    info "Installing: ${packages[*]}"
    log_cmd $PKG_MANAGER install -y "${packages[@]}" || fail "Package installation failed. Check $LOG_FILE"
    ok "System packages installed"
}

install_deps_debian() {
    step "Installing system dependencies (Ubuntu/Debian)"

    info "Updating package cache..."
    log_cmd $PKG_MANAGER update -qq

    local packages=(
        # Build tools
        gcc g++ make pkg-config
        # Libvirt
        libvirt-dev libvirt-daemon-system qemu-kvm virtinst
        # Node.js
        nodejs npm
        # Utilities
        git curl
    )

    # Check if node is too old (need 18+)
    if command -v node &>/dev/null; then
        NODE_VER=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)
        if [ "$NODE_VER" -lt 18 ] 2>/dev/null; then
            warn "Node.js $NODE_VER is too old. Installing Node.js 20 from NodeSource..."
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >> "$LOG_FILE" 2>&1
        fi
    fi

    info "Installing: ${packages[*]}"
    DEBIAN_FRONTEND=noninteractive log_cmd $PKG_MANAGER install -y "${packages[@]}" || fail "Package installation failed. Check $LOG_FILE"
    ok "System packages installed"
}

install_deps() {
    case "$OS_FAMILY" in
        fedora) install_deps_fedora ;;
        debian) install_deps_debian ;;
    esac
}

# ── Enable libvirt ────────────────────────────────────────────────────

enable_libvirt() {
    step "Enabling libvirt"

    systemctl enable --now libvirtd >> "$LOG_FILE" 2>&1 || warn "libvirtd may already be running"

    # Verify libvirt works
    if virsh list --all >> "$LOG_FILE" 2>&1; then
        ok "libvirt is working"
    else
        warn "libvirt test failed — may need reboot or user group fix"
    fi
}

# ── Install Rust ──────────────────────────────────────────────────────

install_rust() {
    step "Checking Rust toolchain"

    # Check if cargo exists — try multiple locations including user homes
    CARGO_BIN=""
    local -a search_paths=()

    # Add known paths
    local cmd_cargo=""
    cmd_cargo="$(command -v cargo 2>/dev/null)" || true
    [ -n "$cmd_cargo" ] && search_paths+=("$cmd_cargo")
    search_paths+=("$HOME/.cargo/bin/cargo")
    search_paths+=("/root/.cargo/bin/cargo")
    search_paths+=("/usr/local/cargo/bin/cargo")
    search_paths+=("/usr/local/bin/cargo")
    search_paths+=("/usr/bin/cargo")
    # Add SUDO_USER's cargo if set
    [ -n "${SUDO_USER:-}" ] && search_paths+=("/home/$SUDO_USER/.cargo/bin/cargo")
    # Scan all user home dirs (nullglob to handle no matches)
    local user_cargo=""
    shopt -s nullglob
    for user_cargo in /home/*/.cargo/bin/cargo; do
        search_paths+=("$user_cargo")
    done
    shopt -u nullglob

    for candidate in "${search_paths[@]}"; do
        if [ -x "$candidate" ] 2>/dev/null; then
            CARGO_BIN="$candidate"
            break
        fi
    done

    if [ -n "$CARGO_BIN" ]; then
        # Ensure RUSTUP_HOME is set so rustup can find the toolchain
        local cargo_dir
        cargo_dir="$(dirname "$(dirname "$CARGO_BIN")")"
        if [ -d "$cargo_dir/../.rustup" ]; then
            export RUSTUP_HOME="$cargo_dir/../.rustup"
        elif [ -d "${cargo_dir%/cargo}/.rustup" ]; then
            export RUSTUP_HOME="${cargo_dir%/cargo}/.rustup"
        fi

        RUST_VER=$($CARGO_BIN --version 2>/dev/null | awk '{print $2}') || true
        if [ -n "$RUST_VER" ]; then
            ok "Rust already installed: $RUST_VER ($CARGO_BIN)"
            export PATH="$(dirname "$CARGO_BIN"):$PATH"
            return
        fi
        # cargo exists but can't run (wrong toolchain config) — try setting default
        local rustup_bin
        rustup_bin="$(dirname "$CARGO_BIN")/rustup"
        if [ -x "$rustup_bin" ]; then
            info "Setting default Rust toolchain..."
            "$rustup_bin" default stable >> "$LOG_FILE" 2>&1 || true
            RUST_VER=$($CARGO_BIN --version 2>/dev/null | awk '{print $2}') || true
            if [ -n "$RUST_VER" ]; then
                ok "Rust configured: $RUST_VER ($CARGO_BIN)"
                export PATH="$(dirname "$CARGO_BIN"):$PATH"
                return
            fi
        fi
        warn "Found cargo at $CARGO_BIN but it failed. Installing fresh..."
        CARGO_BIN=""
    fi

    info "Installing Rust via rustup..."
    export RUSTUP_HOME="${RUSTUP_HOME:-/usr/local/rustup}"
    export CARGO_HOME="${CARGO_HOME:-/usr/local/cargo}"
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path >> "$LOG_FILE" 2>&1 || fail "Rust installation failed"
    export PATH="$CARGO_HOME/bin:$PATH"

    # Also symlink for convenience
    ln -sf "$CARGO_HOME/bin/cargo" /usr/local/bin/cargo 2>/dev/null || true
    ln -sf "$CARGO_HOME/bin/rustc" /usr/local/bin/rustc 2>/dev/null || true

    RUST_VER=$(cargo --version 2>/dev/null | awk '{print $2}')
    ok "Rust installed: $RUST_VER"
}

# ── Clone and build ──────────────────────────────────────────────────

clone_repo() {
    step "Getting virtspawn source"

    # If running from within the repo, use it directly
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [ -f "$script_dir/Makefile" ] && [ -f "$script_dir/Cargo.toml" ]; then
        INSTALL_DIR="$script_dir"
        ok "Using local source at $INSTALL_DIR"
        cd "$INSTALL_DIR"
        return
    fi

    if [ -d "$INSTALL_DIR/.git" ]; then
        info "Updating existing clone at $INSTALL_DIR..."
        cd "$INSTALL_DIR"
        log_cmd git pull --ff-only || warn "git pull failed, using existing code"
    else
        info "Cloning $REPO_URL..."
        rm -rf "$INSTALL_DIR"
        log_cmd git clone "$REPO_URL" "$INSTALL_DIR" || fail "git clone failed. Check network and $LOG_FILE"
        cd "$INSTALL_DIR"
    fi

    ok "Source ready at $INSTALL_DIR"
}

build_rust() {
    step "Building Rust binaries (release mode)"
    info "This may take 2-5 minutes on first build..."

    cd "$INSTALL_DIR"
    log_cmd cargo build --workspace --release || fail "Rust build failed. Check $LOG_FILE"

    ok "Built: target/release/virtspawn-daemon ($(du -h target/release/virtspawn-daemon | cut -f1))"
    ok "Built: target/release/virtspawn-tui ($(du -h target/release/virtspawn-tui | cut -f1))"
}

build_web() {
    step "Building web frontend"

    cd "$INSTALL_DIR/web"

    # Check node version
    NODE_VER=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VER" -lt 18 ] 2>/dev/null; then
        fail "Node.js 18+ required (found: v$NODE_VER)"
    fi
    info "Node.js: $(node --version)"

    info "Installing npm dependencies..."
    log_cmd npm install || fail "npm install failed. Check $LOG_FILE"

    info "Building production bundle..."
    log_cmd npm run build || fail "npm build failed. Check $LOG_FILE"

    ok "Web UI built: $(ls dist/assets/*.js 2>/dev/null | wc -l) assets"
}

# ── Install ──────────────────────────────────────────────────────────

install_files() {
    step "Installing virtspawn"

    cd "$INSTALL_DIR"

    # Binaries
    install -Dm755 target/release/virtspawn-daemon /usr/local/bin/virtspawn-daemon
    install -Dm755 target/release/virtspawn-tui /usr/local/bin/virtspawn
    ok "Binaries -> /usr/local/bin/"

    # Config
    if [ ! -f /etc/virtspawn/config.toml ]; then
        install -Dm644 contrib/virtspawn.toml /etc/virtspawn/config.toml
        ok "Config -> /etc/virtspawn/config.toml"
    else
        info "Config already exists, not overwriting"
    fi

    # Systemd unit
    install -Dm644 contrib/virtspawn-daemon.service /usr/lib/systemd/system/virtspawn-daemon.service
    systemctl daemon-reload
    ok "Systemd unit installed"

    # Web UI
    if [ -d web/dist ]; then
        mkdir -p /usr/local/share/virtspawn/web
        cp -r web/dist/* /usr/local/share/virtspawn/web/
        ok "Web UI -> /usr/local/share/virtspawn/web/"
    fi
}

# ── Start and verify ─────────────────────────────────────────────────

start_daemon() {
    step "Starting virtspawn daemon"

    systemctl enable --now virtspawn-daemon >> "$LOG_FILE" 2>&1 || fail "Failed to start daemon"

    # Wait for it to be ready
    local retries=10
    while [ $retries -gt 0 ]; do
        if curl -sf http://localhost:8081/api/v1/health > /dev/null 2>&1; then
            ok "Daemon is running and healthy"
            return
        fi
        retries=$((retries - 1))
        sleep 1
    done

    warn "Daemon started but health check failed. Check: journalctl -u virtspawn-daemon"
}

# ── Verification tests ───────────────────────────────────────────────

run_tests() {
    step "Running verification tests"

    local passed=0
    local failed=0

    test_endpoint() {
        local desc="$1"
        local url="$2"
        local expect="$3"

        local response
        response=$(curl -sf "$url" 2>/dev/null) || response=""

        if echo "$response" | grep -qF "$expect"; then
            ok "  $desc"
            passed=$((passed + 1))
        else
            echo -e "  ${RED}FAIL${NC} $desc (expected '$expect')"
            failed=$((failed + 1))
        fi
    }

    # API tests
    test_endpoint "Health check" \
        "http://localhost:8081/api/v1/health" "healthy"

    test_endpoint "List VMs" \
        "http://localhost:8081/api/v1/vms" "["

    test_endpoint "Node info" \
        "http://localhost:8081/api/v1/node" "hostname"

    test_endpoint "List networks" \
        "http://localhost:8081/api/v1/networks" "["

    test_endpoint "List storage pools" \
        "http://localhost:8081/api/v1/storage/pools" "["

    test_endpoint "Capabilities" \
        "http://localhost:8081/api/v1/capabilities" "host_arch"

    test_endpoint "List devices" \
        "http://localhost:8081/api/v1/devices" "["

    test_endpoint "List nwfilters" \
        "http://localhost:8081/api/v1/nwfilters" "["

    test_endpoint "List secrets" \
        "http://localhost:8081/api/v1/secrets" "["

    test_endpoint "Metrics endpoint" \
        "http://localhost:8081/api/v1/metrics" "["

    # Web UI test
    local http_code
    http_code=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:8081/ 2>/dev/null) || http_code="000"
    if [ "$http_code" = "200" ]; then
        ok "  Web UI serves (HTTP 200)"
        passed=$((passed + 1))
    else
        echo -e "  ${RED}FAIL${NC} Web UI (HTTP $http_code)"
        failed=$((failed + 1))
    fi

    # Binary tests
    if /usr/local/bin/virtspawn-daemon --help > /dev/null 2>&1; then
        ok "  virtspawn-daemon binary works"
        passed=$((passed + 1))
    else
        echo -e "  ${RED}FAIL${NC} virtspawn-daemon binary"
        failed=$((failed + 1))
    fi

    if /usr/local/bin/virtspawn --help > /dev/null 2>&1; then
        ok "  virtspawn TUI binary works"
        passed=$((passed + 1))
    else
        echo -e "  ${RED}FAIL${NC} virtspawn TUI binary"
        failed=$((failed + 1))
    fi

    # Security validation tests
    local migrate_resp
    migrate_resp=$(curl -s -X POST http://localhost:8081/api/v1/vms/nonexistent/migrate \
        -H 'Content-Type: application/json' \
        -d '{"dest_uri":"http://evil.com","live":false}' 2>/dev/null) || migrate_resp=""
    if echo "$migrate_resp" | grep -qF "Invalid migration URI"; then
        ok "  Migration URI validation works"
        passed=$((passed + 1))
    else
        echo -e "  ${RED}FAIL${NC} Migration URI validation"
        failed=$((failed + 1))
    fi

    local resize_resp
    resize_resp=$(curl -s -X POST http://localhost:8081/api/v1/storage/pools/default/volumes/x/resize \
        -H 'Content-Type: application/json' \
        -d '{"capacity_gb":-1}' 2>/dev/null) || resize_resp=""
    if echo "$resize_resp" | grep -qF "capacity_gb must be"; then
        ok "  Resize validation works"
        passed=$((passed + 1))
    else
        echo -e "  ${RED}FAIL${NC} Resize validation"
        failed=$((failed + 1))
    fi

    echo ""
    echo -e "${BOLD}Test results: ${GREEN}$passed passed${NC}, ${RED}$failed failed${NC}"

    if [ $failed -gt 0 ]; then
        warn "Some tests failed. Check: journalctl -u virtspawn-daemon"
        return 1
    fi
    return 0
}

# ── Uninstall ────────────────────────────────────────────────────────

uninstall() {
    step "Uninstalling virtspawn"

    systemctl stop virtspawn-daemon 2>/dev/null || true
    systemctl disable virtspawn-daemon 2>/dev/null || true

    rm -f /usr/local/bin/virtspawn-daemon
    rm -f /usr/local/bin/virtspawn
    rm -f /usr/lib/systemd/system/virtspawn-daemon.service
    rm -rf /usr/local/share/virtspawn
    systemctl daemon-reload 2>/dev/null || true

    ok "Binaries and service removed"
    info "Config kept at /etc/virtspawn/ (remove manually if desired)"
    info "Source kept at $INSTALL_DIR (remove manually if desired)"
}

# ── Summary ──────────────────────────────────────────────────────────

print_summary() {
    local vm_count
    vm_count=$(curl -sf http://localhost:8081/api/v1/vms 2>/dev/null | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null) || vm_count="?"

    echo ""
    echo -e "${GREEN}${BOLD}============================================${NC}"
    echo -e "${GREEN}${BOLD}  virtspawn installed successfully!${NC}"
    echo -e "${GREEN}${BOLD}============================================${NC}"
    echo ""
    echo -e "  ${CYAN}Web UI:${NC}    http://localhost:8081"
    echo -e "  ${CYAN}TUI:${NC}       virtspawn"
    echo -e "  ${CYAN}API:${NC}       http://localhost:8081/api/v1/health"
    echo -e "  ${CYAN}VMs found:${NC} $vm_count"
    echo ""
    echo -e "  ${YELLOW}Manage:${NC}"
    echo -e "    sudo systemctl status  virtspawn-daemon"
    echo -e "    sudo systemctl restart virtspawn-daemon"
    echo -e "    sudo journalctl -u virtspawn-daemon -f"
    echo ""
    echo -e "  ${YELLOW}Config:${NC}  /etc/virtspawn/config.toml"
    echo -e "  ${YELLOW}Source:${NC}  $INSTALL_DIR"
    echo -e "  ${YELLOW}Log:${NC}     $LOG_FILE"
    echo ""
}

# ── Main ─────────────────────────────────────────────────────────────

main() {
    echo -e "${BOLD}${CYAN}"
    echo "  _   _  _        _"
    echo " (_) (_)| |_  ___| |_  __ _ __ __ __ _"
    echo " | V || |  _|(_-<| _ \/ _\` |\ V  V /| ' \\"
    echo "  \_/ |_| \__|/__/|  _/\__,_| \_/\_/ |_||_|"
    echo "                  |_|"
    echo -e "${NC}"
    echo -e "${BOLD}virtspawn installer${NC} — Modern Libvirt VM Manager"
    echo ""

    # Parse args
    local do_uninstall=false
    local deps_only=false
    local no_start=false
    for arg in "$@"; do
        case "$arg" in
            --uninstall) do_uninstall=true ;;
            --deps-only) deps_only=true ;;
            --no-start)  no_start=true ;;
            --help|-h)
                echo "Usage: $0 [--uninstall] [--deps-only] [--no-start]"
                exit 0
                ;;
        esac
    done

    check_root
    detect_os
    check_arch

    if $do_uninstall; then
        uninstall
        exit 0
    fi

    info "Install log: $LOG_FILE"

    install_deps
    enable_libvirt
    install_rust

    if $deps_only; then
        ok "Dependencies installed. Run '$0' again to build and install."
        exit 0
    fi

    clone_repo
    build_rust
    build_web
    install_files

    if $no_start; then
        ok "Installed but not started. Run: sudo systemctl start virtspawn-daemon"
        exit 0
    fi

    start_daemon
    run_tests || true
    print_summary
}

main "$@"
