#!/usr/bin/env bash
# feature-test.sh — live API checks for ISO media, CD-ROM, guest-agent and console features.
#
# Complements scripts/e2e-test.sh (VM lifecycle) by covering the media/guest-tools
# surface and, deliberately, each feature's FAILURE mode: every bug these features
# shipped with was of the "reported success while doing nothing" kind, so a test
# that only asserts the happy path would have passed throughout.
#
# Read-only with respect to VM state: it never starts, stops or deletes a VM.
# It does attach and then detach a CD-ROM on the target VM.
#
# Usage:
#   ./scripts/feature-test.sh HOST USER PASS
#   ./scripts/feature-test.sh 192.0.2.10 admin secret
#
# Override the VM it exercises with VM=<name> (default: win10-msedge).
set -uo pipefail

HOST="${1:?host}"; USER="${2:?user}"; PASS="${3:?pass}"
BASE="https://${HOST}:5092"
API="${BASE}/api/v1"
JAR="$(mktemp)"; TMP="$(mktemp -d)"
VM="${VM:-win10-msedge}"
PASSN=0; FAILN=0

ok()   { printf '  \033[32mPASS\033[0m  %s\n' "$1"; PASSN=$((PASSN+1)); }
bad()  { printf '  \033[31mFAIL\033[0m  %s — %s\n' "$1" "${2:-}"; FAILN=$((FAILN+1)); }
section() { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }

c() { curl -sk -b "$JAR" "$@"; }
code() { curl -sk -b "$JAR" -o "$TMP/body" -w '%{http_code}' "$@"; }

section "auth"
lc=$(curl -sk -c "$JAR" -o "$TMP/l" -w '%{http_code}' -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}")
[ "$lc" = 200 ] && ok "login" || { bad "login" "HTTP $lc"; exit 1; }
role=$(c "$API/auth/session" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("role"))')
[ "$role" = admin ] && ok "role=admin" || bad "role" "got $role"

section "ISO upload"
head -c 1048576 /dev/urandom > "$TMP/t.iso"
r=$(code -X POST -T "$TMP/t.iso" -H 'Content-Type: application/octet-stream' \
  "$API/browse/isos/upload?filename=featuretest.iso&overwrite=true")
[ "$r" = 200 ] && ok "upload 1MB iso" || bad "upload" "HTTP $r"

for probe in "..%2F..%2Fetc%2Fevil.iso:path separator" "payload.sh:non-iso" ".hidden.iso:hidden" "-rf.iso:leading dash"; do
  fn="${probe%%:*}"; label="${probe##*:}"
  r=$(code -X POST -T "$TMP/t.iso" -H 'Content-Type: application/octet-stream' \
    "$API/browse/isos/upload?filename=$fn")
  [ "$r" = 400 ] && ok "reject $label" || bad "reject $label" "HTTP $r"
done
r=$(code -X POST -T "$TMP/t.iso" -H 'Content-Type: application/octet-stream' \
  "$API/browse/isos/upload?filename=featuretest.iso")
[ "$r" = 400 ] && ok "reject duplicate without overwrite" || bad "duplicate" "HTTP $r"

section "ISO download jobs"
jid=$(c -X POST "$API/browse/isos/download" -H 'Content-Type: application/json' \
  -d '{"url":"https://releases.ubuntu.com/24.04/SHA256SUMS","filename":"tiny-dl.iso","overwrite":true}' \
  | python3 -c 'import json,sys;print(json.load(sys.stdin).get("job_id",""))' 2>/dev/null)
[ -n "$jid" ] && ok "download started (job ${jid:0:8})" || bad "download start" "no job id"
r=$(code -X POST "$API/browse/isos/download" -H 'Content-Type: application/json' \
  -d '{"url":"ftp://example.com/x.iso"}')
[ "$r" = 400 ] && ok "reject non-http scheme" || bad "scheme guard" "HTTP $r"
# .invalid is a reserved TLD (RFC 2606) guaranteed never to resolve — the
# SSRF guard (assert_public_http_host) now rejects it synchronously with 400
# instead of accepting an async job that would only fail later at fetch time.
r=$(code -X POST "$API/browse/isos/download" -H 'Content-Type: application/json' \
  -d '{"url":"https://example.invalid/nope-404.iso","filename":"nope404.iso","overwrite":true}')
[ "$r" = 400 ] && ok "unresolvable host rejected up front" || bad "bad host" "HTTP $r"
sleep 6
c "$API/jobs" | python3 -c '
import json,sys
js=[j for j in json.load(sys.stdin) if j.get("kind")=="iso_download"]
print(f"  {len(js)} download job(s) tracked")
for j in js[:4]: print("   ", j["status"], j["title"][:46])
'

section "console plans (Windows detect / native_ssh / no guacamole)"
c "$API/vms/$VM/consolehub/plan" > "$TMP/plan.json"
python3 - "$TMP/plan.json" <<'PY'
import json,sys
d=json.load(open(sys.argv[1]))
def chk(cond,label,extra=""):
    print(("  \033[32mPASS\033[0m  " if cond else "  \033[31mFAIL\033[0m  ")+label+("" if cond else f" — {extra}"))
chk(d.get("os_hint")=="windows","daemon os_hint=windows",d.get("os_hint"))
chk("native_ssh" in d.get("protocols",[]),"daemon emits native_ssh",d.get("protocols"))
chk("guacamole" not in d,"no guacamole key in daemon plan")
chk(not any("guac" in p for p in d.get("protocols",[])),"no guacamole protocols")
PY

section "CD-ROM lifecycle"
ISO=/var/lib/libvirt/images/isos/featuretest.iso
r=$(code -X POST "$API/vms/$VM/cdrom/insert" -H 'Content-Type: application/json' -d "{\"iso_path\":\"$ISO\"}")
if [ "$r" = 200 ]; then
  tgt=$(python3 -c 'import json;d=json.load(open("'"$TMP/body"'"));print(d.get("target"))')
  rr=$(python3 -c 'import json;d=json.load(open("'"$TMP/body"'"));print(d.get("requires_restart"))')
  ok "insert auto-target -> $tgt (requires_restart=$rr)"
  [ -n "$tgt" ] && [ "$tgt" != sda ] && ok "auto target avoided root disk sda" || bad "auto target" "picked $tgt"
  r2=$(code -X POST "$API/vms/$VM/cdrom/detach/$tgt")
  [ "$r2" = 200 ] && ok "detach drive $tgt" || bad "detach" "HTTP $r2"
else
  bad "insert auto-target" "HTTP $r: $(head -c 150 "$TMP/body")"
fi

section "guest agent channel (idempotent)"
r=$(code -X POST "$API/vms/$VM/guest-agent/channel" -H 'Content-Type: application/json' -d '{}')
if [ "$r" = 200 ]; then
  added=$(python3 -c 'import json;print(json.load(open("'"$TMP/body"'"))["channel"]["added"])')
  ok "channel call ok (added=$added)"
  r2=$(code -X POST "$API/vms/$VM/guest-agent/channel" -H 'Content-Type: application/json' -d '{}')
  a2=$(python3 -c 'import json;print(json.load(open("'"$TMP/body"'"))["channel"]["added"])' 2>/dev/null)
  [ "$a2" = "False" ] && ok "second call is a no-op (idempotent)" || bad "idempotent" "added=$a2"
else
  bad "channel" "HTTP $r"
fi

section "guest agent install media"
r=$(code -X POST "$API/vms/$VM/guest-agent/install-media" -H 'Content-Type: application/json' -d '{}')
if [ "$r" = 200 ]; then
  python3 -c '
import json
d = json.load(open("'"$TMP/body"'"))
cd = d["cdrom"]
print("  target=%s downloaded=%s restart=%s" % (cd["target"], d["iso_downloaded"], d["requires_restart"]))'
  ok "install-media staged the agent ISO"
  t=$(python3 -c 'import json;print(json.load(open("'"$TMP/body"'"))["cdrom"]["target"])')
  code -X POST "$API/vms/$VM/cdrom/detach/$t" >/dev/null
else
  bad "install-media" "HTTP $r: $(head -c 160 "$TMP/body")"
fi

section "windows RDP guard"
r=$(code -X POST "$API/vms/$VM/windows/enable-rdp" -H 'Content-Type: application/json' -d '{}')
[ "$r" = 400 ] && ok "refuses while VM is running" || bad "rdp guard" "HTTP $r"

section "core APIs still healthy"
for n in health vms browse/isos jobs; do
  r=$(code "$API/$n"); [ "$r" = 200 ] && ok "GET $n" || bad "GET $n" "HTTP $r"
done

printf '\n\033[1m== RESULT ==\033[0m  \033[32m%d passed\033[0m, \033[31m%d failed\033[0m\n' "$PASSN" "$FAILN"
rm -rf "$TMP" "$JAR"
[ "$FAILN" -eq 0 ]
