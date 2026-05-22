#!/usr/bin/env bash
# ============================================================================
# package-binary-remote.sh — Build Machina on a remote Linux host and tarball it
# ============================================================================
# Minimal rsync, `make release web` on the server (glibc + libvirt — must match
# target distro), tarball daemon + TUI + web/dist for client handoff.
#
# Usage:
#   ./scripts/package-binary-remote.sh <host> [user] [--fetch] [--reuse-build]
#
# Options:
#   --fetch        Copy tarball to ./dist/ on your laptop
#   --reuse-build  Skip make if target/release/machina-daemon exists
#
# Environment:
#   DEPLOY_HOST / DEPLOY_USER
#   MACHINA_PACKAGE_DIR         Remote output (default: ~/machina-dist)
#   MACHINA_PACKAGE_VERSION     Override version
#   DEPLOY_SSH_TIMEOUT
#   MACHINA_REMOTE_SKIP_SSH_CHECK=1
#
# Prerequisites on remote: Rust, Node/npm, libvirt dev headers (see install.sh --deps-only)
#
# See: docs/PACKAGE_BINARY_REMOTE.md
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

FETCH=false
REUSE_BUILD=false
POSITIONAL=()

for arg in "$@"; do
    case "$arg" in
        --fetch) FETCH=true ;;
        --reuse-build) REUSE_BUILD=true ;;
        -h|--help)
            sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *) POSITIONAL+=("$arg") ;;
    esac
done

HOST="${POSITIONAL[0]:-${DEPLOY_HOST:-}}"
USER="${POSITIONAL[1]:-${DEPLOY_USER:-sus}}"
SSH_TIMEOUT="${DEPLOY_SSH_TIMEOUT:-20}"

if [[ -z "${HOST}" ]]; then
    echo "Usage: $0 <host> [user] [--fetch] [--reuse-build]" >&2
    echo "  See: docs/PACKAGE_BINARY_REMOTE.md" >&2
    exit 1
fi

[ -f "${REPO_DIR}/Makefile" ] || { echo "Not in machina repo" >&2; exit 1; }

VERSION="${MACHINA_PACKAGE_VERSION:-$(sed -n 's/^version = "\(.*\)"/\1/p' "${REPO_DIR}/daemon/Cargo.toml" | head -1)}"
VERSION="${VERSION:-0.1.0}"
ARCH="linux-amd64"
REMOTE="${USER}@${HOST}"
REMOTE_HOME=$(ssh -o BatchMode=yes -o ConnectTimeout="${SSH_TIMEOUT}" "${REMOTE}" 'echo "$HOME"')
BUILD_DIR="${REMOTE_HOME}/.deployment/machina-package"
OUT_DIR="${MACHINA_PACKAGE_DIR:-${REMOTE_HOME}/machina-dist}"
ARTIFACT="machina-${VERSION}-${ARCH}"
LOCAL_DIST="${REPO_DIR}/dist"

RSYNC_EXCLUDES=(
    --exclude='target/'
    --exclude='.git/'
    --exclude='web/node_modules/'
    --exclude='web/dist/'
)

log() { printf '  %s\n' "$*"; }
step() { echo ""; printf '── %s\n' "$*"; }

if [[ "${MACHINA_REMOTE_SKIP_SSH_CHECK:-}" != "1" ]]; then
    step "Preflight: SSH (${REMOTE})"
    ssh -o BatchMode=yes -o ConnectTimeout="${SSH_TIMEOUT}" -o StrictHostKeyChecking=accept-new \
        "${REMOTE}" "true"
    log "SSH OK"
fi

step "Sync source → ${HOST}:${BUILD_DIR}"
ssh "${REMOTE}" "mkdir -p '${BUILD_DIR}'"
rsync -az --delete "${RSYNC_EXCLUDES[@]}" \
    -e "ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=15 -o ServerAliveCountMax=120" \
    "${REPO_DIR}/" "${REMOTE}:${BUILD_DIR}/"

step "Build on remote (make release web)"
BUILD_CMD="cd '${BUILD_DIR}' && make release web"
if $REUSE_BUILD; then
    if ssh "${REMOTE}" "test -x '${BUILD_DIR}/target/release/machina-daemon'"; then
        log "Reusing existing target/release (--reuse-build)"
        BUILD_CMD="true"
    fi
fi

if [[ "${BUILD_CMD}" != "true" ]]; then
    log "Compiling (first run often 10–20 minutes; needs Rust + Node + libvirt dev)…"
    ssh "${REMOTE}" "${BUILD_CMD}" 2>&1 | sed 's/^/  [make] /'
fi

step "Assemble tarball in ${OUT_DIR}"
ssh "${REMOTE}" bash -s <<REMOTE_PACK
set -euo pipefail
OUT_DIR='${OUT_DIR}'
BUILD_DIR='${BUILD_DIR}'
ARTIFACT='${ARTIFACT}'
VERSION='${VERSION}'

STAGE="\${OUT_DIR}/\${ARTIFACT}"
rm -rf "\${STAGE}"
mkdir -p "\${STAGE}/web/dist"
cp "\${BUILD_DIR}/target/release/machina-daemon" "\${STAGE}/"
cp "\${BUILD_DIR}/target/release/machina" "\${STAGE}/" 2>/dev/null || true
chmod +x "\${STAGE}/machina-daemon" "\${STAGE}/machina" 2>/dev/null || true
cp -a "\${BUILD_DIR}/web/dist/." "\${STAGE}/web/dist/"
cp "\${BUILD_DIR}/contrib/machina.toml" "\${STAGE}/machina.toml.example"
cp "\${BUILD_DIR}/contrib/machina-daemon.service" "\${STAGE}/" 2>/dev/null || true

cat > "\${STAGE}/README.txt" <<README_EOF
Machina ${VERSION} — Linux amd64 client bundle
==============================================

Contents:
  machina-daemon      HTTPS API + libvirt/KubeVirt management
  machina             TUI (optional)
  web/dist/           Web UI static assets
  machina.toml.example
  machina-daemon.service  Example systemd unit

Requirements:
  - Linux x86_64 hypervisor host with libvirt (and optional k3s/KubeVirt)
  - Same distro/glibc family as this build host

Quick start:
  sudo mkdir -p /etc/machina /var/lib/machina
  sudo cp machina.toml.example /etc/machina/config.toml
  # edit config; ensure libvirt socket access
  ./machina-daemon --config /etc/machina/config.toml
  Open https://<host>:5092

Or use install.sh from the full source tree for systemd install.

Full guide: docs/PACKAGE_BINARY_REMOTE.md
README_EOF

cd "\${OUT_DIR}"
tar czf "\${ARTIFACT}.tar.gz" "\${ARTIFACT}"
sha256sum "\${ARTIFACT}.tar.gz" | tee "\${ARTIFACT}.tar.gz.sha256"
ls -lh "\${ARTIFACT}.tar.gz"
file "\${STAGE}/machina-daemon"
"\${STAGE}/machina-daemon" --help 2>&1 | head -5 || true
REMOTE_PACK

TARBALL="${ARTIFACT}.tar.gz"
REMOTE_TARBALL="${OUT_DIR}/${TARBALL}"

step "Package ready"
log "Remote: ${REMOTE}:${REMOTE_TARBALL}"

if $FETCH; then
    step "Fetch → ${LOCAL_DIST}/"
    mkdir -p "${LOCAL_DIST}"
    scp -o StrictHostKeyChecking=no \
        "${REMOTE}:${REMOTE_TARBALL}" \
        "${REMOTE}:${OUT_DIR}/${TARBALL}.sha256" \
        "${LOCAL_DIST}/"
    (cd "${LOCAL_DIST}" && shasum -a 256 -c "${TARBALL}.sha256" 2>/dev/null || sha256sum -c "${TARBALL}.sha256")
fi

echo ""
echo "════════════════════════════════════════"
echo "  Machina package complete"
echo "  Archive: ${REMOTE_TARBALL}"
echo "  Docs:    docs/PACKAGE_BINARY_REMOTE.md"
echo "════════════════════════════════════════"
