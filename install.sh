#!/bin/bash
# virtspawn — Automated installer for modern libvirt VM manager
#
# Supports: Fedora, RHEL/CentOS/AlmaLinux/Rocky, Ubuntu/Debian,
#           openSUSE/SLES, Arch/Manjaro, and compatible distros.
#
# Run with --help for full usage information.
#
# Quick start:
#   sudo ./install.sh                                      # Local install
#   sudo ./install.sh --bind 0.0.0.0 --open-firewall      # Remote-accessible
#   ./install.sh --remote root@192.168.1.100               # Deploy to remote
#   sudo ./install.sh --uninstall                          # Remove

set -eo pipefail

INSTALL_DIR="/opt/virtspawn"
LOG_FILE=$(mktemp /tmp/virtspawn-install-XXXXXX.log)
chmod 600 "$LOG_FILE"

BIND_HOST=""
REMOTE_HOST=""
OPEN_FIREWALL=false

info()  { echo "ℹ️  $*"; }
ok()    { echo "✅ $*"; }
warn()  { echo "⚠️  $*"; }
fail()  { echo "❌ $*"; exit 1; }
step()  { echo ""; echo "➡️  $*"; }

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
        fedora)
            PKG_MANAGER="dnf"
            OS_FAMILY="fedora"
            ;;
        rhel|centos|rocky|almalinux|alma)
            PKG_MANAGER="dnf"
            OS_FAMILY="rhel"
            ;;
        ubuntu|debian|linuxmint|pop)
            PKG_MANAGER="apt"
            OS_FAMILY="debian"
            ;;
        opensuse*|sles)
            PKG_MANAGER="zypper"
            OS_FAMILY="suse"
            ;;
        arch|manjaro|endeavouros)
            PKG_MANAGER="pacman"
            OS_FAMILY="arch"
            ;;
        *)
            warn "Unrecognized OS: $OS_ID — attempting generic install"
            # Try to detect package manager
            if command -v dnf &>/dev/null; then
                PKG_MANAGER="dnf"; OS_FAMILY="fedora"
            elif command -v apt &>/dev/null; then
                PKG_MANAGER="apt"; OS_FAMILY="debian"
            elif command -v zypper &>/dev/null; then
                PKG_MANAGER="zypper"; OS_FAMILY="suse"
            elif command -v pacman &>/dev/null; then
                PKG_MANAGER="pacman"; OS_FAMILY="arch"
            else
                fail "No supported package manager found (dnf/apt/zypper/pacman)"
            fi
            ;;
    esac

    info "Detected: $OS_NAME ($OS_FAMILY / $PKG_MANAGER)"
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

# ── Node.js version check and upgrade ────────────────────────────────

ensure_node_18() {
    local node_ver=0
    if command -v node &>/dev/null; then
        node_ver=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)
        if ! [[ "$node_ver" =~ ^[0-9]+$ ]]; then
            node_ver=0
        fi
    fi

    if [ "$node_ver" -ge 18 ] 2>/dev/null; then
        info "Node.js $(node --version) is sufficient"
        return 0
    fi

    warn "Node.js 18+ required (found: ${node_ver:-none}). Installing Node.js 20..."

    case "$OS_FAMILY" in
        fedora)
            # Fedora usually has recent enough Node.js
            if [ "$node_ver" -gt 0 ] 2>/dev/null; then
                $PKG_MANAGER remove -y nodejs npm 2>/dev/null || true
            fi
            curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - >> "$LOG_FILE" 2>&1 || fail "NodeSource setup failed"
            $PKG_MANAGER install -y nodejs >> "$LOG_FILE" 2>&1 || fail "Node.js install failed"
            ;;
        rhel)
            # RHEL/AlmaLinux/Rocky: must remove old node first to avoid conflicts
            $PKG_MANAGER remove -y nodejs npm nodejs-full-i18n nodejs-libs 2>/dev/null || true
            curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - >> "$LOG_FILE" 2>&1 || fail "NodeSource setup failed"
            $PKG_MANAGER install -y nodejs >> "$LOG_FILE" 2>&1 || fail "Node.js install failed"
            ;;
        debian)
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >> "$LOG_FILE" 2>&1 || fail "NodeSource setup failed"
            DEBIAN_FRONTEND=noninteractive $PKG_MANAGER install -y nodejs >> "$LOG_FILE" 2>&1 || fail "Node.js install failed"
            ;;
        suse)
            $PKG_MANAGER install -y nodejs20 npm20 >> "$LOG_FILE" 2>&1 || {
                # Fallback to NodeSource
                curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - >> "$LOG_FILE" 2>&1 || true
                $PKG_MANAGER install -y nodejs >> "$LOG_FILE" 2>&1 || fail "Node.js install failed"
            }
            ;;
        arch)
            pacman -S --noconfirm nodejs npm >> "$LOG_FILE" 2>&1 || fail "Node.js install failed"
            ;;
    esac

    ok "Node.js $(node --version 2>/dev/null || echo '?') installed"
}

# ── Install system dependencies ───────────────────────────────────────

install_deps_fedora() {
    step "Installing system dependencies ($OS_NAME)"
    log_cmd $PKG_MANAGER makecache -q || true

    local packages=(gcc gcc-c++ make pkg-config
        libvirt-devel libvirt-daemon-kvm qemu-kvm virt-install
        pam-devel clang-libs
        openssl git curl)

    info "Installing: ${packages[*]}"
    log_cmd $PKG_MANAGER install -y "${packages[@]}" || fail "Package installation failed. Check $LOG_FILE"
    ok "System packages installed"
}

install_deps_rhel() {
    step "Installing system dependencies ($OS_NAME)"
    log_cmd $PKG_MANAGER makecache -q || true

    # Enable CRB/PowerTools for -devel packages on RHEL clones
    $PKG_MANAGER config-manager --set-enabled crb 2>/dev/null || \
    $PKG_MANAGER config-manager --set-enabled powertools 2>/dev/null || true

    local packages=(gcc gcc-c++ make pkg-config
        libvirt-devel libvirt-daemon-kvm qemu-kvm virt-install
        pam-devel clang-libs clang-devel
        openssl git curl)

    info "Installing: ${packages[*]}"
    log_cmd $PKG_MANAGER install -y "${packages[@]}" || fail "Package installation failed. Check $LOG_FILE"
    ok "System packages installed"
}

install_deps_debian() {
    step "Installing system dependencies ($OS_NAME)"
    log_cmd $PKG_MANAGER update -qq

    local packages=(gcc g++ make pkg-config
        libvirt-dev libvirt-daemon-system qemu-kvm virtinst
        libpam0g-dev libclang-dev
        openssl git curl)

    info "Installing: ${packages[*]}"
    DEBIAN_FRONTEND=noninteractive log_cmd $PKG_MANAGER install -y "${packages[@]}" || fail "Package installation failed. Check $LOG_FILE"
    ok "System packages installed"
}

install_deps_suse() {
    step "Installing system dependencies ($OS_NAME)"
    log_cmd $PKG_MANAGER refresh || true

    local packages=(gcc gcc-c++ make pkg-config
        libvirt-devel libvirt-daemon qemu-kvm
        openssl git curl)

    info "Installing: ${packages[*]}"
    log_cmd $PKG_MANAGER install -y "${packages[@]}" || fail "Package installation failed. Check $LOG_FILE"
    ok "System packages installed"
}

install_deps_arch() {
    step "Installing system dependencies ($OS_NAME)"
    log_cmd pacman -Sy --noconfirm || true

    local packages=(gcc make pkg-config
        libvirt qemu-full virt-install dnsmasq
        openssl git curl)

    info "Installing: ${packages[*]}"
    log_cmd pacman -S --noconfirm --needed "${packages[@]}" || fail "Package installation failed. Check $LOG_FILE"
    ok "System packages installed"
}

install_deps() {
    case "$OS_FAMILY" in
        fedora) install_deps_fedora ;;
        rhel)   install_deps_rhel ;;
        debian) install_deps_debian ;;
        suse)   install_deps_suse ;;
        arch)   install_deps_arch ;;
    esac

    ensure_node_18
}

# ── Enable libvirt ────────────────────────────────────────────────────

enable_libvirt() {
    step "Enabling libvirt"

    systemctl enable --now libvirtd >> "$LOG_FILE" 2>&1 || warn "libvirtd may already be running"

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

    local cmd_cargo=""
    cmd_cargo="$(command -v cargo 2>/dev/null)" || true
    [ -n "$cmd_cargo" ] && search_paths+=("$cmd_cargo")
    search_paths+=("$HOME/.cargo/bin/cargo")
    search_paths+=("/root/.cargo/bin/cargo")
    search_paths+=("/usr/local/cargo/bin/cargo")
    search_paths+=("/usr/local/bin/cargo")
    search_paths+=("/usr/bin/cargo")
    [ -n "${SUDO_USER:-}" ] && search_paths+=("/home/$SUDO_USER/.cargo/bin/cargo")
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

    ln -sf "$CARGO_HOME/bin/cargo" /usr/local/bin/cargo 2>/dev/null || true
    ln -sf "$CARGO_HOME/bin/rustc" /usr/local/bin/rustc 2>/dev/null || true

    RUST_VER=$(cargo --version 2>/dev/null | awk '{print $2}')
    ok "Rust installed: $RUST_VER"
}

# ── Clone and build ──────────────────────────────────────────────────

find_source() {
    step "Locating virtspawn source"

    # If running from within the repo, use it directly
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [ -f "$script_dir/Makefile" ] && [ -f "$script_dir/Cargo.toml" ]; then
        INSTALL_DIR="$script_dir"
        ok "Using local source at $INSTALL_DIR"
        cd "$INSTALL_DIR"
        return
    fi

    # Check common locations
    for candidate in /root/.virtspawn /opt/virtspawn "$HOME/.virtspawn" "$HOME/.deployment/virtspawn"; do
        if [ -f "$candidate/Cargo.toml" ] && [ -f "$candidate/Makefile" ]; then
            INSTALL_DIR="$candidate"
            ok "Found source at $INSTALL_DIR"
            cd "$INSTALL_DIR"
            return
        fi
    done

    fail "Source not found. Clone the repo first or run install.sh from within it."
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

    local node_ver
    node_ver=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)
    if ! [[ "$node_ver" =~ ^[0-9]+$ ]] || [ "$node_ver" -lt 18 ]; then
        fail "Node.js 18+ required (found: v${node_ver:-none})"
    fi
    info "Node.js: $(node --version)"

    info "Installing npm dependencies..."
    log_cmd npm install || fail "npm install failed. Check $LOG_FILE"

    info "Building production bundle..."
    log_cmd npx vite build || log_cmd npm run build || fail "npm build failed. Check $LOG_FILE"

    ok "Web UI built: $(find dist/assets -name '*.js' 2>/dev/null | wc -l) assets"
}

# ── Install ──────────────────────────────────────────────────────────

install_files() {
    step "Installing virtspawn"

    cd "$INSTALL_DIR"

    # Create required directories BEFORE installing systemd units
    # /var/lib/virtspawn MUST exist or systemd ReadWritePaths causes NAMESPACE failure
    mkdir -p /var/lib/virtspawn/backups

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

    # Apply --bind if specified
    if [ -n "$BIND_HOST" ]; then
        sed -i "s/^host = .*/host = \"$BIND_HOST\"/" /etc/virtspawn/config.toml
        ok "Configured daemon to bind to $BIND_HOST"
    fi

    # Systemd units
    install -Dm644 contrib/virtspawn-daemon.service /usr/lib/systemd/system/virtspawn-daemon.service
    if [ -f contrib/virtspawn-backup.service ]; then
        install -Dm644 contrib/virtspawn-backup.service /usr/lib/systemd/system/virtspawn-backup.service
    fi
    if [ -f contrib/virtspawn-backup.timer ]; then
        install -Dm644 contrib/virtspawn-backup.timer /usr/lib/systemd/system/virtspawn-backup.timer
    fi
    systemctl daemon-reload
    ok "Systemd units installed"

    # Scripts
    mkdir -p /usr/local/share/virtspawn/scripts
    for script in scripts/*.sh; do
        [ -f "$script" ] || continue
        install -Dm755 "$script" "/usr/local/share/virtspawn/scripts/$(basename "$script")"
    done
    ok "Scripts -> /usr/local/share/virtspawn/scripts/"

    # Backup config
    if [ -f contrib/backup.conf ] && [ ! -f /etc/virtspawn/backup.conf ]; then
        install -Dm644 contrib/backup.conf /etc/virtspawn/backup.conf
        ok "Backup config -> /etc/virtspawn/backup.conf"
    fi

    # Web UI
    if [ -d web/dist ]; then
        mkdir -p /usr/local/share/virtspawn/web
        cp -r web/dist/* /usr/local/share/virtspawn/web/
        ok "Web UI -> /usr/local/share/virtspawn/web/"
    fi

    # virtspawnctl
    if [ -f virtspawnctl ]; then
        install -Dm755 virtspawnctl /usr/local/bin/virtspawnctl
        ok "virtspawnctl -> /usr/local/bin/"
    fi
}

# ── TLS (HTTPS on :5092) ─────────────────────────────────────────────

ensure_tls_for_https() {
    step "TLS certificate for HTTPS (port 5092)"

    command -v openssl >/dev/null 2>&1 || fail "openssl is required for HTTPS — install openssl and retry"

    local cdir="/etc/virtspawn/ssl"
    local cert="$cdir/cert.pem"
    local key="$cdir/key.pem"
    mkdir -p "$cdir"

    if [ -f "$cert" ] && [ -f "$key" ]; then
        ok "TLS key material already present ($cdir)"
    else
        local hn
        hn=$(hostname -f 2>/dev/null || hostname)
        info "Generating self-signed certificate (browsers show a warning until you replace with your CA)"
        if openssl req -help 2>&1 | grep -q -- '-addext'; then
            log_cmd openssl req -x509 -newkey rsa:4096 \
                -keyout "$key" -out "$cert" \
                -sha256 -days 3650 -nodes \
                -subj "/CN=$hn/O=virtspawn" \
                -addext "subjectAltName=DNS:$hn,DNS:localhost,IP:127.0.0.1"
        else
            log_cmd openssl req -x509 -newkey rsa:4096 \
                -keyout "$key" -out "$cert" \
                -sha256 -days 3650 -nodes \
                -subj "/CN=$hn/O=virtspawn"
        fi
        [ -f "$cert" ] && [ -f "$key" ] || fail "openssl failed — see $LOG_FILE"
        chmod 600 "$key"
        chmod 644 "$cert"
        ok "Self-signed certificate installed"
    fi

    local cfg="/etc/virtspawn/config.toml"
    [ -f "$cfg" ] || return 0
    if grep -q '^\[tls\]' "$cfg" 2>/dev/null; then
        ok "Daemon config already defines [tls]"
        return 0
    fi
    cat >> "$cfg" <<'EOF'

[tls]
enabled = true
cert_path = "/etc/virtspawn/ssl/cert.pem"
key_path = "/etc/virtspawn/ssl/key.pem"
EOF
    ok "Enabled [tls] in /etc/virtspawn/config.toml"
}

# ── Firewall ─────────────────────────────────────────────────────────

open_firewall() {
    step "Configuring firewall"

    if command -v firewall-cmd &>/dev/null && systemctl is-active firewalld &>/dev/null; then
        firewall-cmd --add-port=5092/tcp --permanent >> "$LOG_FILE" 2>&1 || true
        firewall-cmd --reload >> "$LOG_FILE" 2>&1 || true
        ok "Opened port 5092/tcp (firewalld)"
    elif command -v ufw &>/dev/null && ufw status | grep -q "Status: active"; then
        ufw allow 5092/tcp >> "$LOG_FILE" 2>&1 || true
        ok "Opened port 5092/tcp (ufw)"
    elif command -v iptables &>/dev/null; then
        iptables -C INPUT -p tcp --dport 5092 -j ACCEPT 2>/dev/null || \
        iptables -I INPUT -p tcp --dport 5092 -j ACCEPT 2>/dev/null || true
        ok "Opened port 5092/tcp (iptables)"
    else
        info "No firewall detected — port 5092 should be accessible"
    fi
}

# ── Start and verify ─────────────────────────────────────────────────

stop_daemon_for_upgrade() {
    info "Stopping existing virtspawn-daemon (releases TCP :5092 for clean start)..."
    systemctl stop virtspawn-daemon >> "$LOG_FILE" 2>&1 || true
    sleep 2
    # Rare: zombie listener or unrelated process — best-effort clear on Linux.
    if command -v ss >/dev/null 2>&1 && ss -tln 2>/dev/null | grep -q ':5092[[:space:]]'; then
        warn "Port 5092 still occupied — trying to clear listeners (fuser/ss)"
        command -v fuser >/dev/null 2>&1 && fuser -k 5092/tcp >> "$LOG_FILE" 2>&1 || true
        sleep 2
    fi
}

wait_for_https_health() {
    local retries="${1:-15}"
    local attempt=0
    while [ "$attempt" -lt "$retries" ]; do
        if curl -sfk https://localhost:5092/api/v1/health > /dev/null 2>&1; then
            ok "Daemon is running and healthy"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 1
    done
    return 1
}

start_daemon() {
    step "Starting virtspawn daemon"

    stop_daemon_for_upgrade

    systemctl enable virtspawn-daemon >> "$LOG_FILE" 2>&1 || fail "Failed to enable virtspawn-daemon. Check: journalctl -u virtspawn-daemon"
    systemctl start virtspawn-daemon >> "$LOG_FILE" 2>&1 || fail "Failed to start daemon. Check: journalctl -u virtspawn-daemon"

    if wait_for_https_health 15; then
        return 0
    fi

    warn "Health check failed — stopping and starting daemon once more (common after TLS/binary upgrade)"
    stop_daemon_for_upgrade
    systemctl start virtspawn-daemon >> "$LOG_FILE" 2>&1 || fail "Failed to restart daemon. Check: journalctl -u virtspawn-daemon"

    if wait_for_https_health 15; then
        return 0
    fi

    warn "Daemon health check timed out. Showing recent logs:"
    journalctl -u virtspawn-daemon --no-pager -n 25 2>/dev/null || true
    fail "Daemon failed to become healthy at https://localhost:5092/api/v1/health — fix the error above then: sudo systemctl restart virtspawn-daemon"
}

# ── Verification tests ───────────────────────────────────────────────

run_tests() {
    step "Running verification tests"

    local passed=0
    local failed=0

    # Check if auth is enabled — if so, API tests are expected to return 401
    local auth_status
    auth_status=$(curl -sk -o /dev/null -w "%{http_code}" https://localhost:5092/api/v1/vms 2>/dev/null) || auth_status="000"
    local auth_enabled=false
    if [ "$auth_status" = "401" ]; then
        auth_enabled=true
        ok "  PAM authentication is active"
        passed=$((passed + 1))
    fi

    test_endpoint() {
        local desc="$1" url="$2" expect="$3"
        local response
        response=$(curl -sfk "$url" 2>/dev/null) || response=""
        if echo "$response" | grep -qF "$expect"; then
            ok "  $desc"
            passed=$((passed + 1))
        else
            echo "  ❌ FAIL $desc (expected '$expect')"
            failed=$((failed + 1))
        fi
    }

    test_endpoint "Health check"      "https://localhost:5092/api/v1/health"        "healthy"

    # API endpoint tests (skipped when auth is enabled — they correctly return 401)
    if ! $auth_enabled; then
        test_endpoint "List VMs"          "https://localhost:5092/api/v1/vms"           "["
        test_endpoint "Node info"         "https://localhost:5092/api/v1/node"          "hostname"
        test_endpoint "List networks"     "https://localhost:5092/api/v1/networks"      "["
        test_endpoint "List storage"      "https://localhost:5092/api/v1/storage/pools" "["
        test_endpoint "Capabilities"      "https://localhost:5092/api/v1/capabilities"  "host_arch"
        test_endpoint "List devices"      "https://localhost:5092/api/v1/devices"       "["
        test_endpoint "List nwfilters"    "https://localhost:5092/api/v1/nwfilters"     "["
        test_endpoint "List secrets"      "https://localhost:5092/api/v1/secrets"       "["
        test_endpoint "Metrics endpoint"  "https://localhost:5092/api/v1/metrics"       "["
    else
        info "  API tests skipped (auth enabled — endpoints correctly return 401)"
    fi

    # Web UI
    local http_code
    http_code=$(curl -sfk -o /dev/null -w "%{http_code}" https://localhost:5092/ 2>/dev/null) || http_code="000"
    if [ "$http_code" = "200" ]; then
        ok "  Web UI serves (HTTPS 200)"
        passed=$((passed + 1))
    else
        echo "  ❌ FAIL Web UI (HTTP $http_code)"
        failed=$((failed + 1))
    fi

    # Binaries
    if /usr/local/bin/virtspawn-daemon --help > /dev/null 2>&1; then
        ok "  virtspawn-daemon binary"
        passed=$((passed + 1))
    else
        echo "  ❌ FAIL virtspawn-daemon binary"
        failed=$((failed + 1))
    fi

    if /usr/local/bin/virtspawn --help > /dev/null 2>&1; then
        ok "  virtspawn TUI binary"
        passed=$((passed + 1))
    else
        echo "  ❌ FAIL virtspawn TUI binary"
        failed=$((failed + 1))
    fi

    # Security validation (skipped when auth is enabled)
    if $auth_enabled; then
        info "  Security tests skipped (auth enabled)"
    else
    local migrate_resp
    migrate_resp=$(curl -sk -X POST https://localhost:5092/api/v1/vms/nonexistent/migrate \
        -H 'Content-Type: application/json' \
        -d '{"dest_uri":"http://evil.com","live":false}' 2>/dev/null) || migrate_resp=""
    if echo "$migrate_resp" | grep -qF "Invalid migration URI"; then
        ok "  Migration URI validation"
        passed=$((passed + 1))
    else
        echo "  ❌ FAIL Migration URI validation"
        failed=$((failed + 1))
    fi

    local resize_resp
    resize_resp=$(curl -sk -X POST https://localhost:5092/api/v1/storage/pools/default/volumes/x/resize \
        -H 'Content-Type: application/json' \
        -d '{"capacity_gb":-1}' 2>/dev/null) || resize_resp=""
    if echo "$resize_resp" | grep -qF "capacity_gb must be"; then
        ok "  Resize validation"
        passed=$((passed + 1))
    else
        echo "  ❌ FAIL Resize validation"
        failed=$((failed + 1))
    fi
    fi  # end auth_enabled check for security tests

    echo ""
    echo "📊 Test results: ✅ $passed passed, ❌ $failed failed"
    [ $failed -gt 0 ] && return 1
    return 0
}

# ── Remote deploy ────────────────────────────────────────────────────

remote_deploy() {
    local remote="$1"
    local source_dir
    source_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    if [ ! -f "$source_dir/Cargo.toml" ]; then
        fail "Must run --remote from within the virtspawn source directory"
    fi

    step "Deploying to $remote"

    info "Copying source to $remote:~/.deployment/virtspawn (build runs on remote only, not here) ..."
    ssh "$remote" "mkdir -p ~/.deployment/virtspawn"
    rsync -az --delete \
        --exclude target --exclude node_modules --exclude .git --exclude web/dist \
        "$source_dir/" "$remote:~/.deployment/virtspawn/" || fail "rsync failed"
    ok "Source copied"

    info "Running install.sh on $remote (cargo/npm build on server) ..."
    local remote_args=""
    [ -n "$BIND_HOST" ] && remote_args="--bind $BIND_HOST"
    $OPEN_FIREWALL && remote_args="$remote_args --open-firewall"

    ssh "$remote" "cd ~/.deployment/virtspawn && sudo bash install.sh $remote_args" || fail "Remote install failed"

    # Get the remote IP for summary
    local remote_ip
    remote_ip=$(echo "$remote" | sed 's/.*@//')
    echo ""
    echo "============================================"
    echo "✅ Deployed to $remote"
    echo "============================================"
    echo ""
    echo "  🌐 Web UI:  https://$remote_ip:5092"
    echo "  🔗 API:     https://$remote_ip:5092/api/v1/health"
    echo ""
}

# ── Uninstall ────────────────────────────────────────────────────────

uninstall() {
    step "Uninstalling virtspawn"

    systemctl stop virtspawn-daemon 2>/dev/null || true
    systemctl disable virtspawn-daemon 2>/dev/null || true
    systemctl stop virtspawn-backup.timer 2>/dev/null || true
    systemctl disable virtspawn-backup.timer 2>/dev/null || true

    rm -f /usr/local/bin/virtspawn-daemon
    rm -f /usr/local/bin/virtspawn
    rm -f /usr/local/bin/virtspawnctl
    rm -f /usr/lib/systemd/system/virtspawn-daemon.service
    rm -f /usr/lib/systemd/system/virtspawn-backup.service
    rm -f /usr/lib/systemd/system/virtspawn-backup.timer
    rm -rf /usr/local/share/virtspawn
    systemctl daemon-reload 2>/dev/null || true

    ok "Binaries and service removed"
    info "Config kept at /etc/virtspawn/ (remove manually if desired)"
    info "Data kept at /var/lib/virtspawn/ (remove manually if desired)"
}

# ── Summary ──────────────────────────────────────────────────────────

print_summary() {
    local vm_count
    vm_count=$(curl -sfk https://localhost:5092/api/v1/vms 2>/dev/null | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null) || vm_count="?"

    local bind_info="localhost"
    if [ -n "$BIND_HOST" ] && [ "$BIND_HOST" != "127.0.0.1" ]; then
        local ip
        ip=$(hostname -I 2>/dev/null | awk '{print $1}') || ip="<server-ip>"
        bind_info="$ip"
    fi

    echo ""
    echo "============================================"
    echo "✅ virtspawn installed successfully!"
    echo "============================================"
    echo ""
    echo "  🌐 Web UI:    https://$bind_info:5092"
    echo "  🖥️  TUI:       virtspawn"
    echo "  🔗 API:       https://$bind_info:5092/api/v1/health"
    echo "  📊 VMs found: $vm_count"
    echo ""
    echo "  📋 Manage:"
    echo "    sudo systemctl status  virtspawn-daemon"
    echo "    sudo systemctl restart virtspawn-daemon"
    echo "    sudo journalctl -u virtspawn-daemon -f"
    echo ""
    echo "  ⚙️  Config:  /etc/virtspawn/config.toml"
    echo "  📂 Source:  $INSTALL_DIR"
    echo "  📜 Log:     $LOG_FILE"
    echo ""
}

# ── Main ─────────────────────────────────────────────────────────────

main() {
    echo "  _   _  _        _"
    echo " (_) (_)| |_  ___| |_  __ _ __ __ __ _"
    echo " | V || |  _|(_-<| _ \/ _\` |\ V  V /| ' \\"
    echo "  \_/ |_| \__|/__/|  _/\__,_| \_/\_/ |_||_|"
    echo "                  |_|"
    echo ""
    echo "virtspawn installer — Modern Libvirt VM Manager"
    echo ""

    # Parse args
    local do_uninstall=false
    local deps_only=false
    local no_start=false
    local prev_arg=""
    for arg in "$@"; do
        case "$prev_arg" in
            --bind)   BIND_HOST="$arg"; prev_arg=""; continue ;;
            --remote) REMOTE_HOST="$arg"; prev_arg=""; continue ;;
        esac
        case "$arg" in
            --uninstall)     do_uninstall=true ;;
            --deps-only)     deps_only=true ;;
            --no-start)      no_start=true ;;
            --open-firewall) OPEN_FIREWALL=true ;;
            --bind|--remote) prev_arg="$arg" ;;
            --help|-h)
                cat <<'HELPEOF'
Usage: install.sh [OPTIONS]

  Automated installer for virtspawn — a modern libvirt VM manager with
  Web UI, REST API, TUI, backup system, and monitoring.

  Detects the Linux distribution, installs all dependencies (libvirt,
  QEMU/KVM, Rust, Node.js 20), builds from source, deploys binaries
  and systemd services, then runs 15 verification tests.

Install options:
  --bind HOST          Bind daemon to HOST (default: 127.0.0.1)
                       Use 0.0.0.0 to make the web UI accessible from
                       other machines on the network.
  --open-firewall      Open port 5092 in the active firewall.
                       Supports firewalld, ufw, and iptables.
  --no-start           Build and install but don't start the daemon.
                       Useful when you want to edit the config first.
  --deps-only          Only install system dependencies (libvirt, Rust,
                       Node.js) without building or installing virtspawn.

Remote deploy:
  --remote USER@HOST   Deploy to a remote machine over SSH.
                       Copies the source via rsync, then runs this
                       installer on the remote host. Does not require
                       root locally — only on the remote machine.
                       Combine with --bind and --open-firewall.

Uninstall:
  --uninstall          Stop the daemon, remove binaries and systemd units.
                       Config (/etc/virtspawn) and data (/var/lib/virtspawn)
                       are preserved — remove manually if desired.

Supported distributions:
  Fedora, RHEL 8/9, CentOS Stream, AlmaLinux, Rocky Linux,
  Ubuntu 20.04+, Debian 11+, Linux Mint, Pop!_OS,
  openSUSE Leap/Tumbleweed, SLES,
  Arch Linux, Manjaro, EndeavourOS.
  Other distros may work if dnf/apt/zypper/pacman is available.

What gets installed:
  /usr/local/bin/virtspawn-daemon    Daemon binary (REST API + WebSocket)
  /usr/local/bin/virtspawn           TUI binary (terminal interface)
  /usr/local/bin/virtspawnctl        Management helper script
  /usr/local/share/virtspawn/web/    Web UI (React frontend)
  /usr/local/share/virtspawn/scripts/  Backup, demo, status scripts
  /etc/virtspawn/config.toml         Daemon configuration
  /etc/virtspawn/backup.conf         Backup configuration
  /var/lib/virtspawn/backups/        Backup storage directory
  /usr/lib/systemd/system/virtspawn-daemon.service
  /usr/lib/systemd/system/virtspawn-backup.{service,timer}

Prerequisites (installed automatically):
  - libvirt + QEMU/KVM
  - Rust toolchain (via rustup)
  - Node.js 18+ (via NodeSource if distro version is too old)
  - gcc, make, pkg-config, openssl, git, curl

Examples:
  Local install (default — binds to localhost only):
    sudo ./install.sh

  Install and expose on all interfaces with firewall open:
    sudo ./install.sh --bind 0.0.0.0 --open-firewall

  Deploy to a remote server:
    ./install.sh --remote root@192.168.1.100 --bind 0.0.0.0 --open-firewall

  Install dependencies first, build later:
    sudo ./install.sh --deps-only
    sudo ./install.sh

  Remove virtspawn:
    sudo ./install.sh --uninstall

After install:
  Web UI:    https://localhost:5092   (self-signed by default — browser warning until you install a real cert)
  TUI:       virtspawn
  API test:  curl -sk https://localhost:5092/api/v1/health
  Logs:      sudo journalctl -u virtspawn-daemon -f
  Config:    sudo vim /etc/virtspawn/config.toml
  Restart:   sudo systemctl restart virtspawn-daemon
HELPEOF
                exit 0
                ;;
        esac
    done

    # Remote deploy mode — doesn't need root locally
    if [ -n "$REMOTE_HOST" ]; then
        remote_deploy "$REMOTE_HOST"
        exit 0
    fi

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

    find_source
    build_rust
    build_web
    install_files
    ensure_tls_for_https

    if $OPEN_FIREWALL; then
        open_firewall
    fi

    if $no_start; then
        ok "Installed but not started. Run: sudo systemctl start virtspawn-daemon"
        exit 0
    fi

    start_daemon
    run_tests || true
    print_summary
}

main "$@"
