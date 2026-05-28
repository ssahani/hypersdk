# shellcheck shell=bash
# Shared helpers for Machina E2E tests (sourced by e2e-test.sh).

e2e_ok()   { echo "  ✅ $*"; (( E2E_PASS++ )) || true; }
e2e_fail() { echo "  ❌ $*"; (( E2E_FAIL++ )) || true; }
e2e_warn() { echo "  ⚠️  $*"; }
e2e_hdr()  { echo ""; echo "=== $* ==="; }

e2e_host_from_base() {
  echo "${E2E_BASE}" | sed -E 's#https?://([^/:]+).*#\1#'
}

e2e_init_cookie() {
  E2E_COOKIE="$(mktemp -t machina_e2e_cookie.XXXXXX)"
  export E2E_COOKIE
}

e2e_cleanup() {
  rm -f "${E2E_COOKIE:-}"
  echo ""
}

e2e_assert_json_key() {
  local resp="$1" key="$2" label="$3"
  if echo "$resp" | grep -q "\"${key}\""; then
    e2e_ok "$label"
  else
    e2e_fail "$label — got: $resp"
  fi
}

e2e_assert_http() {
  local got="$1" want="$2" label="$3"
  if [[ "$got" == "$want" ]]; then
    e2e_ok "$label (HTTP $got)"
  else
    e2e_fail "$label — expected HTTP $want, got $got"
  fi
}

e2e_assert_json_true() {
  local resp="$1" key="$2" label="$3"
  if echo "$resp" | grep -qE "\"${key}\"[[:space:]]*:[[:space:]]*true"; then
    e2e_ok "$label"
  else
    e2e_fail "$label — got: $resp"
  fi
}

e2e_login() {
  e2e_hdr "LOGIN"
  local r
  r="$(${E2E_CURL} -c "$E2E_COOKIE" -X POST "${E2E_BASE}/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${E2E_USER}\",\"password\":\"${E2E_PASSWORD}\"}")"
  echo "  $r"
  e2e_assert_json_key "$r" "status" "login returns status"
  if ! echo "$r" | grep -q '"status":"ok"'; then
    e2e_fail "PAM auth rejected — check username/password"
    return 1
  fi
  return 0
}

e2e_summary() {
  echo ""
  echo "══════════════════════════════════════════"
  echo "  Results: ${E2E_PASS} passed, ${E2E_FAIL} failed"
  echo "══════════════════════════════════════════"
  if [[ "${E2E_FAIL}" -eq 0 ]]; then
    echo "✅ All tests passed"
    return 0
  fi
  echo "❌ ${E2E_FAIL} test(s) FAILED"
  return 1
}
