#!/usr/bin/env bash
# Legacy wrapper — cluster bootstrap now runs inside machina-daemon (Rust: daemon/src/cluster_bootstrap.rs).
# Use the Web UI (Kubernetes → Overview → Bootstrap script) or:
#   POST /api/v1/k8s/cluster-bootstrap
#
# For a manual shell-only flow without the daemon, keep a copy of the recipe in git history or run each
# phase from the Machina documentation.

set -euo pipefail

echo "[INFO] This script is deprecated — bootstrap runs in machina-daemon (Rust)." >&2
echo "[INFO] Start machina-daemon and use the Kubernetes overview \"Bootstrap script\" controls." >&2
exit 1
