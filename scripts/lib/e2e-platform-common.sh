# shellcheck shell=bash
# Shared helpers for Machina platform E2E (controller :5093).

e2e_platform_ok()   { echo "  ✅ $*"; (( E2E_PASS++ )) || true; }
e2e_platform_fail() { echo "  ❌ $*"; (( E2E_FAIL++ )) || true; }
e2e_platform_warn() { echo "  ⚠️  $*"; }
e2e_platform_hdr()  { echo ""; echo "=== $* ==="; }

e2e_platform_host_from_base() {
  echo "${E2E_PLATFORM_BASE}" | sed -E 's#https?://([^/:]+).*#\1#'
}

e2e_platform_auth_header() {
  local user="${E2E_PLATFORM_USER:-admin}"
  local pass="${E2E_PLATFORM_PASS:-admin}"
  printf 'Authorization: Basic %s' "$(printf '%s:%s' "$user" "$pass" | base64 | tr -d '\n')"
}

e2e_platform_curl() {
  curl -sk --connect-timeout 10 --max-time "${E2E_PLATFORM_TIMEOUT:-120}" \
    -H "$(e2e_platform_auth_header)" "$@"
}

e2e_platform_http_code() {
  e2e_platform_curl -o /dev/null -w '%{http_code}' "$@"
}

e2e_platform_assert_http() {
  local got="$1" want="$2" label="$3"
  if [[ "$got" == "$want" ]]; then
    e2e_platform_ok "$label (HTTP $got)"
  else
    e2e_platform_fail "$label — expected HTTP $want, got $got"
  fi
}

e2e_platform_assert_json_key() {
  local resp="$1" key="$2" label="$3"
  if echo "$resp" | grep -q "\"${key}\""; then
    e2e_platform_ok "$label"
  else
    e2e_platform_fail "$label — got: $resp"
  fi
}

e2e_platform_assert_json_true() {
  local resp="$1" key="$2" label="$3"
  if echo "$resp" | grep -qE "\"${key}\"[[:space:]]*:[[:space:]]*true"; then
    e2e_platform_ok "$label"
  else
    e2e_platform_fail "$label — got: $resp"
  fi
}

e2e_platform_json_field() {
  local resp="$1" field="$2"
  echo "$resp" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    print('')
    sys.exit(0)
if isinstance(data, list):
    print(data[0].get('$field', '') if data else '')
elif isinstance(data, dict):
    print(data.get('$field', ''))
else:
    print('')
" 2>/dev/null
}

e2e_platform_wait_task() {
  local operation="$1"
  local timeout="${2:-180}"
  local soft="${3:-0}"
  local elapsed=0 r status
  while (( elapsed < timeout )); do
    r="$(e2e_platform_curl "${E2E_PLATFORM_BASE}/api/v1/tasks?operation=${operation}&limit=10")"
    status="$(echo "$r" | python3 -c "
import json, sys
try:
    tasks = json.load(sys.stdin)
except Exception:
    sys.exit(0)
for t in tasks:
    op = t.get('operation', '')
    if op == '$operation' or op.startswith('$operation'):
        print(t.get('status', ''))
        sys.exit(0)
" 2>/dev/null)"
    case "$status" in
      succeeded|success|completed)
        e2e_platform_ok "task $operation -> $status"
        return 0
        ;;
      failed|error|cancelled)
        if [[ "$soft" == "1" ]]; then
          return 1
        fi
        e2e_platform_fail "task $operation -> $status — $r"
        return 1
        ;;
    esac
    sleep 3
    elapsed=$((elapsed + 3))
  done
  if [[ "$soft" == "1" ]]; then
    return 1
  fi
  e2e_platform_fail "task $operation timed out after ${timeout}s"
  return 1
}

e2e_platform_wait_vm_state() {
  local vm_id="$1" want_state="$2"
  local timeout="${3:-180}"
  local elapsed=0 r state
  while (( elapsed < timeout )); do
    r="$(e2e_platform_curl "${E2E_PLATFORM_BASE}/api/v1/vms/${vm_id}")"
    state="$(e2e_platform_json_field "$r" observed_state)"
    if [[ "$state" == "$want_state" ]]; then
      e2e_platform_ok "VM $vm_id observed_state=$want_state"
      return 0
    fi
    sleep 3
    elapsed=$((elapsed + 3))
  done
  e2e_platform_fail "VM $vm_id not $want_state after ${timeout}s — last: $r"
  return 1
}

e2e_platform_summary() {
  echo ""
  echo "══════════════════════════════════════════"
  echo "  Platform E2E: ${E2E_PASS} passed, ${E2E_FAIL} failed"
  echo "══════════════════════════════════════════"
  if [[ "${E2E_FAIL}" -eq 0 ]]; then
    echo "✅ All platform tests passed"
    return 0
  fi
  echo "❌ ${E2E_FAIL} platform test(s) FAILED"
  return 1
}
