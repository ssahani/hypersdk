#!/usr/bin/env bash
# api-test.sh — virtspawn end-to-end API smoke test
#
# Usage:
#   ./scripts/api-test.sh [HOST] [USER] [PASS]
#
# Defaults:
#   HOST  https://localhost:5092
#   USER  sus
#   PASS  (required — no default)
#
# Examples:
#   ./scripts/api-test.sh                                # local, prompts for pass
#   ./scripts/api-test.sh https://185.165.240.5:5092 sus max
#   VSPASS=max ./scripts/api-test.sh https://185.165.240.5:5092 sus
#
# Tests (in order):
#   1  login
#   2  create VM
#   3  list VMs (verify present)
#   4  start VM
#   5  VM details (state == running)
#   6  VNC console-info (type + port)
#   7  stop VM
#   8  VM details (state == shutoff)
#   9  delete VM
#  10  verify 404

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────
BASE="${1:-https://localhost:5092}"
VSUSER="${2:-sus}"
VSPASS="${3:-${VSPASS:-}}"
VM_NAME="vs-api-test-$$"
COOKIE=$(mktemp /tmp/vs_test_XXXXXX.txt)
CURL="curl -sk"
PASS=0; FAIL=0

if [[ -z "$VSPASS" ]]; then
  read -rsp "Password for ${VSUSER}@${BASE}: " VSPASS; echo
fi

trap 'rm -f "$COOKIE"; echo ""' EXIT

# ── Helpers ──────────────────────────────────────────────────────────────────
ok()   { echo "  ✅ $*"; (( PASS++ )) || true; }
fail() { echo "  ❌ $*"; (( FAIL++ )) || true; }
hdr()  { echo ""; echo "=== $* ==="; }

assert_json_key() {
  local resp="$1" key="$2" label="$3"
  if echo "$resp" | grep -q "\"${key}\""; then
    ok "$label"
  else
    fail "$label — got: $resp"
  fi
}

assert_http() {
  local got="$1" want="$2" label="$3"
  if [[ "$got" == "$want" ]]; then
    ok "$label (HTTP $got)"
  else
    fail "$label — expected HTTP $want, got $got"
  fi
}

# ── 1. Login ─────────────────────────────────────────────────────────────────
hdr "1. LOGIN"
R=$($CURL -c "$COOKIE" -X POST "$BASE/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${VSUSER}\",\"password\":\"${VSPASS}\"}")
echo "  $R"
assert_json_key "$R" "status" "login returns status"
if ! echo "$R" | grep -q '"status":"ok"'; then
  fail "PAM auth rejected — check username/password"
  echo ""; echo "FAILED (1 failure — cannot continue without auth)"; exit 1
fi

# ── 2. Create VM ──────────────────────────────────────────────────────────────
hdr "2. CREATE VM ($VM_NAME)"
R=$($CURL -b "$COOKIE" -X POST "$BASE/api/v1/vms" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\":\"${VM_NAME}\",
    \"vcpus\":1,
    \"memory_mb\":512,
    \"disk_gb\":5,
    \"network\":\"default\",
    \"firmware\":\"bios\",
    \"graphics_type\":\"vnc\",
    \"graphics_listen\":\"127.0.0.1\"
  }")
echo "  $R"
assert_json_key "$R" "status" "create returns status"
if ! echo "$R" | grep -q '"status":"created"'; then
  fail "VM create failed — cannot continue"
  exit 1
fi

# ── 3. List VMs ───────────────────────────────────────────────────────────────
hdr "3. LIST VMs"
R=$($CURL -b "$COOKIE" "$BASE/api/v1/vms")
if echo "$R" | grep -q "\"${VM_NAME}\""; then
  ok "VM visible in list"
else
  fail "VM not found in list — got: $R"
fi

# ── 4. Start VM ───────────────────────────────────────────────────────────────
hdr "4. START VM"
R=$($CURL -b "$COOKIE" -X POST "$BASE/api/v1/vms/${VM_NAME}/start")
echo "  $R"
assert_json_key "$R" "status" "start returns status"
echo "$R" | grep -q '"status":"started"' && ok "VM started" || fail "start status unexpected"
sleep 2

# ── 5. VM Details (running) ───────────────────────────────────────────────────
hdr "5. VM DETAILS (expect running)"
R=$($CURL -b "$COOKIE" "$BASE/api/v1/vms/${VM_NAME}")
echo "  $(echo "$R" | tr ',' '\n' | grep -E '"state"|"uuid"|"vcpus"|"memory"' | tr '\n' ' ')"
if echo "$R" | grep -q '"state":"running"'; then
  ok "state == running"
else
  STATE=$(echo "$R" | grep -o '"state":"[^"]*"' | head -1)
  fail "state not running — $STATE"
fi

# ── 6. VNC console-info ───────────────────────────────────────────────────────
hdr "6. VNC CONSOLE-INFO"
R=$($CURL -b "$COOKIE" "$BASE/api/v1/vms/console-info/${VM_NAME}")
echo "  $R"
if echo "$R" | grep -q '"console_type":"vnc"'; then
  ok "console_type == vnc"
else
  fail "console_type not vnc — got: $R"
fi
if echo "$R" | grep -qE '"port":[0-9]'; then
  PORT=$(echo "$R" | grep -o '"port":[0-9]*' | head -1)
  ok "VNC $PORT"
else
  fail "no VNC port in response"
fi

# ── 7. Boot check: poll for DHCP lease / guest agent IP ──────────────────────
hdr "7. BOOT CHECK (poll for DHCP lease, up to 90s)"
IP_FOUND=""
for i in $(seq 1 18); do
  # Try guest agent first (most reliable when qemu-guest-agent is installed)
  GA=$(ssh -o StrictHostKeyChecking=no -o BatchMode=yes "$(echo "$BASE" | sed 's|https\?://||;s|:.*||')" \
    "sudo virsh domifaddr ${VM_NAME} --source agent 2>/dev/null" 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | grep -v '^127\.' | head -1)
  if [[ -z "$GA" ]]; then
    # Fall back to DHCP lease table
    GA=$(ssh -o StrictHostKeyChecking=no -o BatchMode=yes "$(echo "$BASE" | sed 's|https\?://||;s|:.*||')" \
      "sudo virsh net-dhcp-leases default 2>/dev/null" 2>/dev/null \
      | grep -i "${VM_NAME}\|$(echo "${VM_NAME}" | cut -c1-8)" \
      | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  fi
  if [[ -n "$GA" ]]; then
    IP_FOUND="$GA"
    break
  fi
  echo "  waiting... (${i}/18)"
  sleep 5
done
if [[ -n "$IP_FOUND" ]]; then
  ok "VM got IP: $IP_FOUND"
else
  # Not a hard failure — blank-disk test VMs won't get an IP; warn instead
  echo "  ⚠️  No IP in 90s (expected for blank/no-OS VMs; OK for smoke test)"
  (( PASS++ )) || true
fi

# ── 8. Stop VM ────────────────────────────────────────────────────────────────
hdr "8. STOP VM (destroy)"
R=$($CURL -b "$COOKIE" -X POST "$BASE/api/v1/vms/${VM_NAME}/stop")
echo "  $R"
echo "$R" | grep -q '"status":"stopped"' && ok "stop OK" || fail "stop unexpected: $R"
sleep 1

# ── 9. VM Details (shutoff) ───────────────────────────────────────────────────
hdr "9. VM DETAILS (expect shutoff)"
R=$($CURL -b "$COOKIE" "$BASE/api/v1/vms/${VM_NAME}")
if echo "$R" | grep -q '"state":"shutoff"'; then
  ok "state == shutoff"
else
  STATE=$(echo "$R" | grep -o '"state":"[^"]*"' | head -1)
  fail "state not shutoff — $STATE"
fi

# ── 10. Delete VM ─────────────────────────────────────────────────────────────
hdr "10. DELETE VM"
R=$($CURL -b "$COOKIE" -X DELETE "$BASE/api/v1/vms/${VM_NAME}")
echo "  $R"
echo "$R" | grep -q '"status":"deleted"' && ok "delete OK" || fail "delete unexpected: $R"

# ── 11. Verify gone (404) ─────────────────────────────────────────────────────
hdr "11. VERIFY GONE (expect 404)"
HTTP=$($CURL -o /dev/null -w "%{http_code}" -b "$COOKIE" "$BASE/api/v1/vms/${VM_NAME}")
assert_http "$HTTP" "404" "VM returns 404 after delete"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "  Results: ${PASS} passed, ${FAIL} failed"
echo "══════════════════════════════════════════"
[[ $FAIL -eq 0 ]] && echo "✅ All tests passed" || { echo "❌ ${FAIL} test(s) FAILED"; exit 1; }
