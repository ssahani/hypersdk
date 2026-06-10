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
GUAC_PORT="8080"
OPEN_FIREWALL=false
DO_UNINSTALL=false
DO_STATUS=false

info()  { echo "ℹ️  $*"; }
ok()    { echo "✅ $*"; }
warn()  { echo "⚠️  $*"; }
fail()  { echo "❌ $*"; exit 1; }
step()  { echo ""; echo "➡️  $*"; }

log_cmd() { "$@" >>"$LOG_FILE" 2>&1; }

usage() {
    cat <<'EOF'
install-guacamole.sh [--bind ADDR] [--port PORT] [--open-firewall] [--status] [--uninstall]

Deploys guacd + PostgreSQL + Guacamole (Docker Compose) with JSON auth for machina.
Writes /etc/machina/guacamole.env and enables [guacamole] in /etc/machina/config.toml.

Requires: docker compose (or podman-compose), root.
Default: Guacamole on http://127.0.0.1:8080/guacamole (guacd uses host network for libvirt VNC).
EOF
    exit 0
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --bind) GUAC_BIND="${2:?}"; shift 2 ;;
        --port) GUAC_PORT="${2:?}"; shift 2 ;;
        --open-firewall) OPEN_FIREWALL=true; shift ;;
        --uninstall) DO_UNINSTALL=true; shift ;;
        --status) DO_STATUS=true; shift ;;
        -h|--help) usage ;;
        *) warn "Unknown arg: $1"; shift ;;
    esac
done

[[ "$(id -u)" -eq 0 ]] || fail "Run as root: sudo bash scripts/install-guacamole.sh"

compose_cmd() {
    if docker compose version &>/dev/null; then
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
    if declare -F install_primary_ipv4 &>/dev/null 2>&1; then
        return 0
    fi
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
        return 0
    fi

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
}

patch_machina_config() {
    step "Enabling [guacamole] in $CFG"
    # shellcheck source=/dev/null
    source "$ENV_FILE"
    local base_url="http://${GUAC_BIND}:${GUAC_PORT}/guacamole"
    if [[ "$GUAC_BIND" == "127.0.0.1" ]]; then
        base_url="http://127.0.0.1:${GUAC_PORT}/guacamole"
    fi

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

smoke_test() {
    step "Smoke-testing Guacamole"
    local code
    code=$(curl -sf -o /dev/null -w "%{http_code}" "http://127.0.0.1:${GUAC_PORT}/guacamole/" 2>/dev/null) || code="000"
    if [[ "$code" == "200" || "$code" == "302" ]]; then
        ok "Guacamole web responds (HTTP $code)"
    else
        warn "Guacamole HTTP check returned $code — see: docker logs machina-guacamole"
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

[[ -f "$COMPOSE_FILE" ]] || fail "Missing $COMPOSE_FILE — run from machina repo root"

command -v docker &>/dev/null || fail "Docker required for Guacamole install"
docker info &>/dev/null || fail "Docker daemon not running"

ensure_env_file
# shellcheck source=/dev/null
source "$ENV_FILE"
export GUACAMOLE_BIND="$GUAC_BIND"
export GUACAMOLE_PORT="$GUAC_PORT"

step "Starting Guacamole stack (compose)"
compose_cmd up -d >>"$LOG_FILE" 2>&1 || fail "docker compose up failed — see $LOG_FILE"
ok "Containers started"

step "Initializing PostgreSQL schema (if needed)"
bash "${COMPOSE_DIR}/initdb.sh" >>"$LOG_FILE" 2>&1 || fail "Database init failed — see $LOG_FILE"

compose_cmd up -d guacamole >>"$LOG_FILE" 2>&1 || true

patch_machina_config
$OPEN_FIREWALL && open_guac_firewall
smoke_test

if systemctl is-active machina-daemon &>/dev/null; then
    info "Restarting machina-daemon to load [guacamole] config"
    systemctl restart machina-daemon >>"$LOG_FILE" 2>&1 || warn "machina-daemon restart failed"
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
