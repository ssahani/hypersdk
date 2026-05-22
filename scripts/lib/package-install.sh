#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
# shellcheck source=/dev/null
[[ -f "${ROOT}/.package-lib/package-ui.sh" ]] && source "${ROOT}/.package-lib/package-ui.sh"

_PKG_SESSION_START=${SECONDS}
pkg_install_welcome "Machina"
pkg_banner "Machina client install" "libvirt / KVM hypervisor · not Kubernetes"
pkg_step_init 4

pkg_step "Host dependencies (libvirt, qemu)"
if [[ -x ./install-client-deps.sh ]]; then
  sudo ./install-client-deps.sh && pkg_step_done || { pkg_warn "deps had issues"; pkg_step_done; }
else
  pkg_fail "install-client-deps.sh missing"
  exit 1
fi

pkg_step "Configuration"
sudo mkdir -p /etc/machina /var/lib/machina 2>/dev/null || true
if [[ -f machina.toml.example ]] && [[ ! -f /etc/machina/config.toml ]]; then
  sudo cp machina.toml.example /etc/machina/config.toml
  pkg_ok "Created /etc/machina/config.toml"
  pkg_detail "Edit before production use"
else
  cp machina.toml.example ./config.toml.local 2>/dev/null || true
  pkg_ok "config.toml.local template (or /etc/machina/config.toml exists)"
fi
pkg_step_done

pkg_step "Verify binaries"
[[ -x ./machina-daemon ]] && pkg_ok "machina-daemon" || { pkg_fail "machina-daemon missing"; exit 1; }
[[ -x ./machina ]] && pkg_ok "machina TUI CLI" || pkg_skip "machina TUI not bundled"
[[ -d ./web/dist ]] && pkg_ok "web/dist dashboard assets" || pkg_warn "web/dist missing"
pkg_step_done

pkg_step "Smoke test"
[[ -x ./test-package.sh ]] && ./test-package.sh || pkg_warn "test-package.sh issues"
pkg_step_done

_machina_ui=$(pkg_access_url https 5092)
_machina_host=$(pkg_primary_host_label)
pkg_summary "Install complete"
pkg_next_steps \
  "https://zyvor.dev · © @zyvor 2026" \
  "Host checks: ./test-host.sh" \
  "Production install: sudo ./install-full.sh --open-firewall" \
  "Quick start: sudo ./machina-daemon --config /etc/machina/config.toml" \
  "UI: ${_machina_ui} (${_machina_host})" \
  "Docs: HOST_SETUP.txt · PREREQUISITES.txt" \
  "Remove: ./uninstall.sh --yes [--remove-dir]"
