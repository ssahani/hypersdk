#!/usr/bin/env bash
# Chaos smoke tests for platform controller (batch 16)
# Usage: ./scripts/e2e-chaos-platform.sh USER HOST
set -euo pipefail

USER=${1:?usage: e2e-chaos-platform.sh USER HOST}
HOST=${2:?usage: e2e-chaos-platform.sh USER HOST}
BASE="http://${HOST}:5093"
AUTH=(-u "${MACHINA_E2E_USER:-admin}:${MACHINA_E2E_PASS:-admin}")

echo "== Chaos: controller health after rapid task listing =="
for _ in $(seq 1 20); do
  curl -sfS "${BASE}/api/v1/health" >/dev/null
  curl -sfS "${AUTH[@]}" "${BASE}/api/v1/tasks" >/dev/null || true
done
echo "OK: health stable under burst reads"

echo "== Chaos: migrate precheck structure =="
VM_ID=$(curl -sfS "${AUTH[@]}" "${BASE}/api/v1/vms" | jq -r '.[0].id // empty')
HOST_ID=$(curl -sfS "${AUTH[@]}" "${BASE}/api/v1/hosts" | jq -r '.[0].id // empty')
if [[ -n "$VM_ID" && -n "$HOST_ID" ]]; then
  BODY=$(curl -sfS "${AUTH[@]}" -H 'Content-Type: application/json' \
    -d "{\"dest_host_id\":\"$HOST_ID\",\"live\":true}" \
    "${BASE}/api/v1/vms/${VM_ID}/migrate/precheck")
  echo "$BODY" | jq -e '.checks | type == "array"' >/dev/null
  echo "OK: precheck returns checks array"
else
  echo "SKIP: no VM/host for precheck"
fi

echo "== Chaos: support bundle + policy endpoints =="
curl -sfS "${AUTH[@]}" "${BASE}/api/v1/support/bundle" | jq -e '.controller_id' >/dev/null
curl -sfS "${AUTH[@]}" "${BASE}/api/v1/policy/rules" >/dev/null
curl -sfS "${AUTH[@]}" "${BASE}/api/v1/upgrade/matrix" >/dev/null
echo "OK: batch 15/16 APIs"

echo "All chaos smoke checks passed."
