#!/bin/bash
# virtspawn installer — installs dependencies, builds, and sets up the service
# Usage: curl -sSL https://raw.githubusercontent.com/ssahani/-virtspawn/main/scripts/install.sh | sudo bash
set -euo pipefail

info()  { echo "ℹ️  $*"; }
ok()    { echo "✅ $*"; }
warn()  { echo "⚠️  $*"; }
fail()  { echo "❌ $*"; exit 1; }

# ── Detect distro ────────────────────────────────────────────────────
detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        echo "$ID"
    else
        echo "unknown"
    fi
}

DISTRO=$(detect_distro)
info "Detected distribution: $DISTRO"

# ── Install system dependencies ──────────────────────────────────────
install_deps() {
    info "Installing system dependencies..."
    case "$DISTRO" in
        fedora|rhel|centos|rocky|alma)
            dnf install -y gcc make pkg-config \
                libvirt-devel qemu-img socat novnc \
                nodejs npm git 2>/dev/null || \
            dnf install -y gcc make pkgconfig \
                libvirt-devel qemu-img socat \
                nodejs npm git
            ;;
        debian|ubuntu|linuxmint|pop)
            apt-get update -qq
            apt-get install -y gcc make pkg-config \
                libvirt-dev qemu-utils socat novnc \
                nodejs npm git
            ;;
        arch|manjaro|endeavouros)
            pacman -Sy --noconfirm --needed gcc make pkg-config \
                libvirt qemu-base socat novnc \
                nodejs npm git
            ;;
        opensuse*|sles)
            zypper install -y gcc make pkg-config \
                libvirt-devel qemu-tools socat \
                nodejs npm git
            ;;
        *)
            warn "Unknown distro '$DISTRO' — install manually:"
            echo "    gcc make pkg-config libvirt-devel qemu-img socat novnc nodejs npm git"
            ;;
    esac
    ok "System dependencies installed"
}

# ── Install Rust (if needed) ─────────────────────────────────────────
install_rust() {
    if command -v cargo &>/dev/null; then
        ok "Rust already installed ($(rustc --version))"
        return
    fi
    info "Installing Rust toolchain..."
    if ! curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y; then
        fail "Rust installation failed"
    fi
    if [ -f "$HOME/.cargo/env" ]; then
        source "$HOME/.cargo/env"
    fi
    export PATH="$HOME/.cargo/bin:$PATH"
    if ! command -v cargo &>/dev/null; then
        fail "Rust installed but cargo not found in PATH"
    fi
    ok "Rust installed ($(rustc --version))"
}

# ── Enable libvirtd ──────────────────────────────────────────────────
enable_libvirtd() {
    if systemctl is-active --quiet libvirtd; then
        ok "libvirtd is already running"
    else
        info "Starting libvirtd..."
        systemctl enable --now libvirtd
        ok "libvirtd enabled and started"
    fi
}

# ── Clone and build ──────────────────────────────────────────────────
build_virtspawn() {
    local BUILD_DIR="/tmp/virtspawn-build"
    if [ -d "$BUILD_DIR" ]; then
        rm -rf "$BUILD_DIR"
    fi

    info "Cloning virtspawn..."
    git clone --depth 1 https://github.com/ssahani/-virtspawn.git "$BUILD_DIR"
    cd "$BUILD_DIR"

    info "Building Rust binaries (release)..."
    if ! make release; then
        fail "Rust build failed"
    fi

    info "Building web frontend..."
    if command -v npm &>/dev/null; then
        if ! make web; then
            warn "Web frontend build failed — installing without web UI"
        fi
    else
        warn "npm not found — skipping web frontend build"
    fi

    info "Installing..."
    make install

    ok "virtspawn installed to /usr/local/bin/"
    cd /
    rm -rf "$BUILD_DIR"
}

# ── Open firewall port ───────────────────────────────────────────────
open_firewall() {
    local PORT=8081
    if command -v firewall-cmd &>/dev/null; then
        if firewall-cmd --query-port=${PORT}/tcp 2>/dev/null; then
            ok "Firewall port $PORT already open"
        else
            info "Opening firewall port $PORT..."
            firewall-cmd --permanent --add-port=${PORT}/tcp
            firewall-cmd --reload
            ok "Firewall port $PORT opened"
        fi
    elif command -v ufw &>/dev/null; then
        info "Opening UFW port $PORT..."
        ufw allow ${PORT}/tcp
        ok "UFW port $PORT opened"
    elif command -v iptables &>/dev/null; then
        info "Adding iptables rule for port $PORT..."
        iptables -A INPUT -p tcp --dport ${PORT} -j ACCEPT
        ok "iptables port $PORT opened"
    else
        warn "No firewall manager found — port $PORT may need manual opening"
    fi
}

# ── Enable and start service ─────────────────────────────────────────
start_service() {
    info "Enabling virtspawn-daemon service..."
    systemctl daemon-reload
    systemctl enable --now virtspawn-daemon
    sleep 2

    if systemctl is-active --quiet virtspawn-daemon; then
        ok "virtspawn-daemon is running"
    else
        fail "virtspawn-daemon failed to start — check: journalctl -u virtspawn-daemon -e"
    fi
}

# ── Verify ───────────────────────────────────────────────────────────
verify() {
    info "Verifying installation..."
    local HEALTH
    HEALTH=$(curl -s http://127.0.0.1:8081/api/v1/health 2>/dev/null || echo '{}')
    if echo "$HEALTH" | grep -q '"healthy"'; then
        ok "API is healthy"
    else
        warn "API health check failed — daemon may still be starting"
    fi

    if curl -s http://127.0.0.1:8081/ | grep -q '<!DOCTYPE html>'; then
        ok "Web UI is accessible"
    else
        warn "Web UI not accessible — run: make web && sudo make install"
    fi

    local IP
    IP=$(hostname -I 2>/dev/null | awk '{print $1}')

    echo ""
    echo "╔══════════════════════════════════════════════════════╗"
    echo "║  ✅ virtspawn installed successfully!                ║"
    echo "╠══════════════════════════════════════════════════════╣"
    echo "║                                                      ║"
    echo "║  🌐 Web UI:  http://localhost:8081                   ║"
    if [ -n "$IP" ]; then
    echo "║  🌐 Remote:  http://${IP}:8081"
    fi
    echo "║  🖥️  TUI:     virtspawn                              ║"
    echo "║  🔗 API:     http://localhost:8081/api/v1/health     ║"
    echo "║  📋 Logs:    journalctl -u virtspawn-daemon -f       ║"
    echo "║  🎮 Demo:    ./scripts/demo.sh                       ║"
    echo "║                                                      ║"
    echo "╚══════════════════════════════════════════════════════╝"
}

# ── Main ─────────────────────────────────────────────────────────────
main() {
    echo ""
    echo "╔══════════════════════════════════════╗"
    echo "║  🖥️  virtspawn installer              ║"
    echo "║  Libvirt VM Management Suite         ║"
    echo "╚══════════════════════════════════════╝"
    echo ""

    if [ "$(id -u)" -ne 0 ]; then
        fail "Please run as root: sudo bash install.sh"
    fi

    install_deps
    install_rust
    enable_libvirtd
    build_virtspawn
    open_firewall
    start_service
    verify
}

main "$@"
