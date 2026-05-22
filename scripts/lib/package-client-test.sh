#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
# shellcheck source=/dev/null
[[ -f "${ROOT}/.package-lib/package-ui.sh" ]] && source "${ROOT}/.package-lib/package-ui.sh"

_PKG_SESSION_START=${SECONDS}
pkg_counters_reset
pkg_banner "Machina package test" "Daemon · TUI · dashboard assets"

[[ -x ./machina-daemon ]] && pkg_ok "machina-daemon" || pkg_fail "machina-daemon"
./machina-daemon --help 2>&1 | head -3 | while read -r l; do pkg_detail "${l}"; done || true

if [[ -x ./test-host.sh ]]; then
  ./test-host.sh || pkg_warn "test-host.sh — see HOST_SETUP.txt"
fi

if curl -skf https://127.0.0.1:5092/health >/dev/null 2>&1; then
  pkg_ok "daemon health https://127.0.0.1:5092"
else
  pkg_skip "daemon not running (start machina-daemon after config)"
fi

pkg_summary "Package test"
[[ "${_PKG_COUNTERS_FAIL}" -eq 0 ]]
