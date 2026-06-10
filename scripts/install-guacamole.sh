#!/usr/bin/env bash
# scripts/install-guacamole.sh — optional Apache Guacamole (Docker) + machina [guacamole] config.
#
#   sudo bash scripts/install-guacamole.sh
#   sudo bash scripts/install-guacamole.sh --bind 0.0.0.0 --open-firewall
#   sudo bash scripts/install-guacamole.sh --status
#   sudo bash scripts/install-guacamole.sh --uninstall
set -euo pipefail

INSTALLER_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_DIR="${INSTALLER_ROOT}/contrib/guacamole"
COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.yml"
ENV_FILE="/etc/machina/guacamole.env"
CFG="/etc/machina/config.toml"
LOG_FILE="$(mktemp /tmp/machina-guacamole-install-XXXXXX.log)"
chmod 600 "$LOG_FILE"

GUAC_BIND="127.0.0.1"
GUAC_PORT="8081"
OPEN_FIREWALL=false
INSTALL_DOCKER=false
DO_UNINSTALL=false
DO_STATUS=false
OS_FAMILY=""
PKG_MANAGER=""
CONTAINER_CLI="docker"

info()  { echo "ℹ️  $*"; }
ok()    { echo "✅ $*"; }
warn()  { echo "⚠️  $*"; }
fail()  { echo "❌ $*"; exit 1; }
step()  { echo ""; echo "➡️  $*"; }

log_cmd() { "$@" >>"$LOG_FILE" 2>&1; }

resolve_compose_dir() {
    local candidate
    for candidate in \
        "/usr/local/share/machina/guacamole" \
        "${INSTALLER_ROOT}/contrib/guacamole"; do
        if [[ -f "${candidate}/docker-compose.yml" ]]; then
            COMPOSE_DIR="$candidate"
            COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.yml"
            return 0
        fi
    done
    return 1
}

detect_os() {
    if [[ -f /etc/os-release ]]; then
        # shellcheck source=/dev/null
        . /etc/os-release
        case "${ID:-}" in
            fedora) OS_FAMILY=fedora; PKG_MANAGER=dnf ;;
            rhel|centos|almalinux|rocky|opencloudos|cloudlinux) OS_FAMILY=rhel; PKG_MANAGER=dnf ;;
            ubuntu|debian|linuxmint|pop) OS_FAMILY=debian; PKG_MANAGER=apt-get ;;
            opensuse*|sles) OS_FAMILY=suse; PKG_MANAGER=zypper ;;
            arch|manjaro|endeavouros) OS_FAMILY=arch; PKG_MANAGER=pacman ;;
            *) OS_FAMILY=unknown; PKG_MANAGER="" ;;
        esac
    fi
}

ensure_container_runtime() {
    if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
        CONTAINER_CLI=docker
        ok "Docker is running"
        return 0
    fi
    if command -v podman &>/dev/null && podman info &>/dev/null 2>&1; then
        if ! command -v podman-compose &>/dev/null; then
            $INSTALL_DOCKER || fail "podman-compose missing — re-run with --install-docker"
            detect_os
            step "Installing podman-compose (Podman stack on RHEL-family hosts)"
            log_cmd $PKG_MANAGER install -y podman-compose \
                || fail "Could not install podman-compose — see $LOG_FILE"
        fi
        CONTAINER_CLI=podman
        ok "Podman is running (using podman-compose)"
        return 0
    fi
    $INSTALL_DOCKER || fail "No container runtime — re-run with --install-docker (used automatically by install.sh --with-guacamole)"

    step "Installing container runtime"
    detect_os
    case "$OS_FAMILY" in
        fedora)
            log_cmd $PKG_MANAGER install -y docker docker-compose-plugin
            systemctl enable docker >>"$LOG_FILE" 2>&1 || true
            systemctl start docker >>"$LOG_FILE" 2>&1 || fail "Docker failed to start — see $LOG_FILE"
            CONTAINER_CLI=docker
            ;;
        rhel)
            if ! rpm -q epel-release &>/dev/null; then
                log_cmd $PKG_MANAGER install -y epel-release || true
            fi
            if log_cmd $PKG_MANAGER install -y docker docker-compose-plugin; then
                systemctl enable docker >>"$LOG_FILE" 2>&1 || true
                systemctl start docker >>"$LOG_FILE" 2>&1 || true
            fi
            if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
                CONTAINER_CLI=docker
            else
                info "Docker CE not in repos — using Podman + podman-compose (standard on EL9)"
                log_cmd $PKG_MANAGER install -y podman podman-compose \
                    || fail "Could not install podman-compose — see $LOG_FILE"
                systemctl enable podman.socket >>"$LOG_FILE" 2>&1 || true
                systemctl start podman.socket >>"$LOG_FILE" 2>&1 || true
                podman info &>/dev/null || fail "Podman failed to start — see $LOG_FILE"
                CONTAINER_CLI=podman
            fi
            ;;
        debian)
            DEBIAN_FRONTEND=noninteractive log_cmd $PKG_MANAGER update -qq
            DEBIAN_FRONTEND=noninteractive log_cmd $PKG_MANAGER install -y docker.io docker-compose-plugin \
                || fail "Could not install docker.io — see $LOG_FILE"
            systemctl enable docker >>"$LOG_FILE" 2>&1 || true
            systemctl start docker >>"$LOG_FILE" 2>&1 || fail "Docker failed to start — see $LOG_FILE"
            CONTAINER_CLI=docker
            ;;
        suse)
            log_cmd $PKG_MANAGER install -y docker docker-compose
            systemctl enable docker >>"$LOG_FILE" 2>&1 || true
            systemctl start docker >>"$LOG_FILE" 2>&1 || true
            CONTAINER_CLI=docker
            ;;
        arch)
            log_cmd $PKG_MANAGER -S --noconfirm --needed docker docker-compose
            systemctl enable docker >>"$LOG_FILE" 2>&1 || true
            systemctl start docker >>"$LOG_FILE" 2>&1 || true
            CONTAINER_CLI=docker
            ;;
        *)
            fail "Cannot auto-install a container runtime on this OS"
            ;;
    esac
    if [[ "$CONTAINER_CLI" == docker ]]; then
        docker info &>/dev/null || fail "Docker installed but not responding"
        ok "Docker installed and running"
    else
        podman info &>/dev/null || fail "Podman installed but not responding"
        ok "Podman + podman-compose ready"
    fi
}

usage() {
    cat <<'EOF'
install-guacamole.sh [--bind ADDR] [--port PORT] [--open-firewall] [--install-docker] [--status] [--uninstall]

Deploys guacd + PostgreSQL + Guacamole (Docker Compose) with JSON auth for machina.
Writes /etc/machina/guacamole.env and enables [guacamole] in /etc/machina/config.toml.

install.sh --with-guacamole calls this with --install-docker automatically.
Default: Guacamole on http://127.0.0.1:8081/guacamole (8080 is reserved for GuestKit worker).
EOF
    exit 0
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --bind) GUAC_BIND="${2:?}"; shift 2 ;;
        --port) GUAC_PORT="${2:?}"; shift 2 ;;
        --open-firewall) OPEN_FIREWALL=true; shift ;;
        --install-docker) INSTALL_DOCKER=true; shift ;;
        --uninstall) DO_UNINSTALL=true; shift ;;
        --status) DO_STATUS=true; shift ;;
        -h|--help) usage ;;
        *) warn "Unknown arg: $1"; shift ;;
    esac
done

[[ "$(id -u)" -eq 0 ]] || fail "Run as root: sudo bash scripts/install-guacamole.sh"

resolve_compose_dir || fail "Missing docker-compose.yml — install machina first or run from repo root"

compose_cmd() {
    if [[ "$CONTAINER_CLI" == podman ]] || { ! command -v docker &>/dev/null && command -v podman-compose &>/dev/null; }; then
        podman-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
    elif docker compose version &>/dev/null 2>&1; then
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
    elif command -v docker-compose &>/dev/null; then
        docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
    elif command -v podman-compose &>/dev/null; then
        podman-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
    else
        fail "docker compose, docker-compose, or podman-compose required"
    fi
}

install_primary_ipv4() {
    local ip=""
    if command -v ip &>/dev/null; then
        ip=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i=1;i<=NF;i++) if ($i=="src") { print $(i+1); exit }}')
    fi
    [[ -z "$ip" ]] && ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    [[ -n "$ip" && "$ip" != "127.0.0.1" ]] && echo "$ip" || echo "127.0.0.1"
}

# shellcheck source=scripts/lib/disable-firewalld.sh
source "${INSTALLER_ROOT}/scripts/lib/disable-firewalld.sh" 2>/dev/null || true

open_guac_firewall() {
    step "Opening firewall for Guacamole port ${GUAC_PORT}/tcp"
    if command -v firewall-cmd &>/dev/null && systemctl is-active firewalld &>/dev/null; then
        firewall-cmd --add-port="${GUAC_PORT}/tcp" --permanent >>"$LOG_FILE" 2>&1 || true
        firewall-cmd --reload >>"$LOG_FILE" 2>&1 || true
        ok "Opened ${GUAC_PORT}/tcp (firewalld)"
    elif command -v ufw &>/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
        ufw allow "${GUAC_PORT}/tcp" >>"$LOG_FILE" 2>&1 || true
        ok "Opened ${GUAC_PORT}/tcp (ufw)"
    else
        info "No active firewall detected — port ${GUAC_PORT} should be reachable if bound to 0.0.0.0"
    fi
}

ensure_env_file() {
    mkdir -p /etc/machina
    if [[ -f "$ENV_FILE" ]]; then
        # shellcheck source=/dev/null
        set -a
        # shellcheck disable=SC1090
        source "$ENV_FILE"
        set +a
        ok "Using existing $ENV_FILE"
    else
        step "Generating $ENV_FILE"
        local pg_pass json_secret
        pg_pass=$(openssl rand -hex 16)
        json_secret=$(openssl rand -hex 16)

        cat >"$ENV_FILE" <<EOF
POSTGRES_DB=guacamole_db
POSTGRES_USER=guacamole_user
POSTGRES_PASSWORD=${pg_pass}
JSON_SECRET_KEY=${json_secret}
GUACAMOLE_BIND=${GUAC_BIND}
GUACAMOLE_PORT=${GUAC_PORT}
EOF
        chmod 600 "$ENV_FILE"
        ok "Created $ENV_FILE (JSON_SECRET_KEY + postgres password)"
        return 0
    fi

    # Keep bind/port in sync when re-run with new flags
    if grep -q '^GUACAMOLE_BIND=' "$ENV_FILE"; then
        sed -i "s/^GUACAMOLE_BIND=.*/GUACAMOLE_BIND=${GUAC_BIND}/" "$ENV_FILE"
    else
        echo "GUACAMOLE_BIND=${GUAC_BIND}" >>"$ENV_FILE"
    fi
    if grep -q '^GUACAMOLE_PORT=' "$ENV_FILE"; then
        sed -i "s/^GUACAMOLE_PORT=.*/GUACAMOLE_PORT=${GUAC_PORT}/" "$ENV_FILE"
    else
        echo "GUACAMOLE_PORT=${GUAC_PORT}" >>"$ENV_FILE"
    fi
}

patch_machina_config() {
    step "Enabling [guacamole] in $CFG"
    # shellcheck source=/dev/null
    source "$ENV_FILE"
    local base_url="http://127.0.0.1:${GUAC_PORT}/guacamole"

    mkdir -p /etc/machina
    [[ -f "$CFG" ]] || touch "$CFG"

    python3 - "$CFG" "$JSON_SECRET_KEY" "$base_url" <<'PY'
import re, sys
from pathlib import Path

cfg_path, secret, base_url = sys.argv[1:4]
text = Path(cfg_path).read_text(encoding="utf-8")
block = f"""[guacamole]
enabled = true
json_secret_hex = "{secret}"
base_url = "{base_url}"
public_vnc_host = ""
fetch_token = true
json_username = "machina"
"""
if re.search(r"^\[guacamole\]", text, re.M):
    text = re.sub(r"^\[guacamole\][^\[]*", block + "\n", text, count=1, flags=re.S)
else:
    if not text.endswith("\n"):
        text += "\n"
    text += "\n" + block
Path(cfg_path).write_text(text, encoding="utf-8")
PY
    ok "Updated $CFG — restart machina-daemon to pick up [guacamole]"
}

patch_platform_env() {
    local platform_env="/etc/default/machina-platform"
    [[ -f "$platform_env" ]] || return 0
    step "Syncing Guacamole env into $platform_env"
    # shellcheck source=/dev/null
    source "$ENV_FILE"
    local base_url="http://127.0.0.1:${GUAC_PORT}/guacamole"
    for kv in "GUACAMOLE_BASE_URL=${base_url}" "GUACAMOLE_JSON_SECRET_HEX=${JSON_SECRET_KEY}"; do
        local key="${kv%%=*}"
        local val="${kv#*=}"
        if grep -q "^${key}=" "$platform_env"; then
            sed -i "s|^${key}=.*|${key}=${val}|" "$platform_env"
        else
            echo "${key}=${val}" >>"$platform_env"
        fi
    done
    ok "Updated $platform_env — restart machina-controller to pick up Guacamole URL"
}

smoke_test() {
    step "Smoke-testing Guacamole"
    local code
    code=$(curl -sf -o /dev/null -w "%{http_code}" "http://127.0.0.1:${GUAC_PORT}/guacamole/" 2>/dev/null) || code="000"
    if [[ "$code" == "200" || "$code" == "302" ]]; then
        ok "Guacamole web responds (HTTP $code)"
    else
        warn "Guacamole HTTP check returned $code — see: ${CONTAINER_CLI} logs machina-guacamole"
    fi
}

status_guacamole() {
    step "Guacamole stack status"
    if [[ -f "$ENV_FILE" ]]; then
        info "Env: $ENV_FILE"
        grep -E '^GUACAMOLE_|^POSTGRES_DB=' "$ENV_FILE" | sed 's/PASSWORD=.*/PASSWORD=***/; s/JSON_SECRET_KEY=.*/JSON_SECRET_KEY=***/'
    fi
    if [[ -f "$COMPOSE_FILE" && -f "$ENV_FILE" ]]; then
        compose_cmd ps 2>/dev/null || warn "compose ps failed"
    fi
    if [[ -f "$CFG" ]] && grep -q '^\[guacamole\]' "$CFG"; then
        ok "[guacamole] present in $CFG"
    else
        warn "[guacamole] not configured in $CFG"
    fi
    exit 0
}

uninstall_guacamole() {
    step "Removing Guacamole stack"
    if [[ -f "$ENV_FILE" && -f "$COMPOSE_FILE" ]]; then
        compose_cmd down -v >>"$LOG_FILE" 2>&1 || warn "compose down failed (see $LOG_FILE)"
    fi
    if [[ -f "$CFG" ]]; then
        python3 - "$CFG" <<'PY'
import re, sys
from pathlib import Path
p = Path(sys.argv[1])
text = p.read_text(encoding="utf-8")
text = re.sub(r"\n?\[guacamole\][^\[]*", "\n", text, count=1, flags=re.S)
p.write_text(text.rstrip() + "\n", encoding="utf-8")
PY
        ok "Removed [guacamole] from $CFG"
    fi
    ok "Guacamole uninstalled (env file kept at $ENV_FILE — remove manually if desired)"
    exit 0
}

$DO_STATUS && status_guacamole
$DO_UNINSTALL && uninstall_guacamole

ensure_container_runtime

ensure_env_file
# shellcheck source=/dev/null
source "$ENV_FILE"
export GUACAMOLE_BIND="$GUAC_BIND"
export GUACAMOLE_PORT="$GUAC_PORT"
export GUAC_CONTAINER_CLI="$CONTAINER_CLI"

step "Starting Guacamole stack (compose)"
compose_cmd up -d >>"$LOG_FILE" 2>&1 || fail "compose up failed — see $LOG_FILE"
ok "Containers started"

step "Initializing PostgreSQL schema (if needed)"
bash "${COMPOSE_DIR}/initdb.sh" >>"$LOG_FILE" 2>&1 || fail "Database init failed — see $LOG_FILE"

compose_cmd up -d guacamole >>"$LOG_FILE" 2>&1 || true

patch_machina_config
patch_platform_env
$OPEN_FIREWALL && open_guac_firewall
smoke_test

if systemctl is-active machina-daemon &>/dev/null; then
    info "Restarting machina-daemon to load [guacamole] config"
    systemctl restart machina-daemon >>"$LOG_FILE" 2>&1 || warn "machina-daemon restart failed"
fi
if systemctl is-active machina-controller &>/dev/null; then
    info "Restarting machina-controller to load Guacamole env"
    systemctl restart machina-controller >>"$LOG_FILE" 2>&1 || warn "machina-controller restart failed"
fi

echo ""
echo "============================================"
echo "✅ Guacamole installed"
echo "============================================"
echo "  Web UI:     http://${GUAC_BIND}:${GUAC_PORT}/guacamole/"
echo "  machina:    GET /api/v1/vms/{name}/guacamole-auth (when VM running + VNC)"
echo "  Config:     $CFG  +  $ENV_FILE"
echo "  Log:        $LOG_FILE"
echo "  Status:     sudo bash scripts/install-guacamole.sh --status"
echo ""
