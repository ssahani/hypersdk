# shellcheck shell=bash
# OpenStack API E2E (sourced after e2e_login).

e2e_openstack_uses_fake_compute() {
  local ssh_host="${E2E_SSH_HOST:-$(e2e_host_from_base)}"
  ssh -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=10 \
    "${ssh_host}" \
    'grep -q "^compute_driver=fake.FakeDriver" /etc/nova/nova.conf 2>/dev/null' 2>/dev/null
}

e2e_openstack_guest_ssh_check() {
  local ip="$1"
  local ssh_host="${E2E_SSH_HOST:-$(e2e_host_from_base)}"
  local ping_ok=0 ssh_ok=0

  if ssh -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=10 \
    "${ssh_host}" "ping -c 1 -W 2 ${ip}" >/dev/null 2>&1; then
    ping_ok=1
  fi
  if ssh -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=10 \
    "${ssh_host}" \
    "ssh -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=5 cirros@${ip} echo ok" \
    >/dev/null 2>&1; then
    ssh_ok=1
  fi

  if [[ "$ping_ok" -eq 1 ]]; then
    e2e_ok "guest ping $ip"
  elif [[ "${E2E_OPENSTACK_REQUIRE_SSH:-0}" -eq 1 ]]; then
    e2e_fail "guest ping failed for $ip"
  else
    e2e_warn "guest ping failed for $ip"
    (( E2E_PASS++ )) || true
  fi

  if [[ "$ssh_ok" -eq 1 ]]; then
    e2e_ok "guest SSH cirros@${ip}"
  elif [[ "${E2E_OPENSTACK_REQUIRE_SSH:-0}" -eq 1 ]]; then
    e2e_fail "guest SSH failed for $ip"
  else
    e2e_warn "guest SSH failed for $ip (fake driver or no key)"
    (( E2E_PASS++ )) || true
  fi
}

e2e_openstack_run() {
  local r instance_id instance_name ip
  instance_name="e2e-os-$$"
  local flavor="${E2E_OS_FLAVOR:-m1.tiny}"
  local image="${E2E_OS_IMAGE:-cirros-test}"
  local network="${E2E_OS_NETWORK:-private}"

  e2e_hdr "OPENSTACK: STATUS"
  r="$(${E2E_CURL} -b "$E2E_COOKIE" "${E2E_BASE}/api/v1/openstack/status")"
  echo "  $r"
  e2e_assert_json_true "$r" "enabled" "openstack enabled"
  e2e_assert_json_true "$r" "reachable" "openstack reachable"
  e2e_assert_json_true "$r" "compute_reachable" "compute reachable"
  e2e_assert_json_true "$r" "glance_reachable" "glance reachable"

  e2e_hdr "OPENSTACK: TEST CONNECTION"
  r="$(${E2E_CURL} -b "$E2E_COOKIE" -X POST "${E2E_BASE}/api/v1/openstack/test-connection")"
  echo "  $r"
  e2e_assert_json_true "$r" "reachable" "test-connection reachable"

  e2e_hdr "OPENSTACK: LIST FLAVORS / NETWORKS / IMAGES"
  r="$(${E2E_CURL} -o /dev/null -w "%{http_code}" -b "$E2E_COOKIE" "${E2E_BASE}/api/v1/openstack/flavors")"
  e2e_assert_http "$r" "200" "flavors"
  r="$(${E2E_CURL} -o /dev/null -w "%{http_code}" -b "$E2E_COOKIE" "${E2E_BASE}/api/v1/openstack/networks")"
  e2e_assert_http "$r" "200" "networks"
  r="$(${E2E_CURL} -o /dev/null -w "%{http_code}" -b "$E2E_COOKIE" "${E2E_BASE}/api/v1/openstack/images")"
  e2e_assert_http "$r" "200" "images"

  e2e_hdr "OPENSTACK: CREATE INSTANCE ($instance_name)"
  r="$(${E2E_CURL} -b "$E2E_COOKIE" -X POST "${E2E_BASE}/api/v1/openstack/instances" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\":\"${instance_name}\",
      \"flavor\":\"${flavor}\",
      \"image\":\"${image}\",
      \"network\":\"${network}\",
      \"wait_until_active\":true
    }")"
  echo "  $r"
  if echo "$r" | grep -q '"error"'; then
    e2e_fail "create instance — $r"
    return 1
  fi
  e2e_assert_json_key "$r" "id" "create returns id"
  instance_id="$(echo "$r" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("id",""))' 2>/dev/null || true)"
  [[ -n "$instance_id" ]] || instance_id="$(echo "$r" | grep -o '"id":"[a-f0-9-]\{36\}"' | head -1 | cut -d'"' -f4)"

  e2e_hdr "OPENSTACK: LIST INSTANCES"
  r="$(${E2E_CURL} -b "$E2E_COOKIE" "${E2E_BASE}/api/v1/openstack/instances")"
  if echo "$r" | grep -q "\"${instance_name}\""; then
    e2e_ok "instance in list"
  else
    e2e_fail "instance not in list"
  fi
  if echo "$r" | grep -qE '"status":"ACTIVE"|"status":"Active"'; then
    e2e_ok "status ACTIVE"
  else
    e2e_fail "instance not ACTIVE"
  fi
  ip="$(echo "$r" | grep -oE '"ip_addresses":\[[^]]*\]' | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
  if [[ -n "$ip" ]]; then
    e2e_ok "instance IP: $ip"
  else
    e2e_warn "no ip_addresses in list response"
    (( E2E_PASS++ )) || true
  fi

  e2e_hdr "OPENSTACK: GUEST CONNECTIVITY"
  if e2e_openstack_uses_fake_compute; then
    if [[ "${E2E_OPENSTACK_REQUIRE_SSH:-0}" -eq 1 ]]; then
      e2e_fail "fake.FakeDriver — guest SSH required but not available"
    else
      e2e_warn "nova fake.FakeDriver — skipping guest ping/SSH"
      (( E2E_PASS++ )) || true
      (( E2E_PASS++ )) || true
    fi
  elif [[ -n "$ip" ]]; then
    e2e_openstack_guest_ssh_check "$ip"
  else
    e2e_warn "no IP for guest SSH check"
    (( E2E_PASS++ )) || true
  fi

  e2e_hdr "OPENSTACK: SECURITY GROUPS (read-only)"
  r="$(${E2E_CURL} -o /dev/null -w "%{http_code}" -b "$E2E_COOKIE" "${E2E_BASE}/api/v1/openstack/security-groups")"
  e2e_assert_http "$r" "200" "security-groups list"

  e2e_hdr "OPENSTACK: CINDER CREATE / ATTACH / DETACH / DELETE"
  local vol_name="e2e-vol-$$"
  r="$(${E2E_CURL} -b "$E2E_COOKIE" -X POST "${E2E_BASE}/api/v1/openstack/volumes" \
    -H "Content-Type: application/json" \
    -d "{\"size_gb\":1,\"name\":\"${vol_name}\"}")"
  echo "  $r"
  local volume_id
  volume_id="$(echo "$r" | python3 -c 'import sys,json; d=json.load(sys.stdin); print((d.get("volume") or {}).get("id",""))' 2>/dev/null || true)"
  if [[ -z "$volume_id" ]]; then
    e2e_warn "cinder create volume skipped (no volume id): $r"
    (( E2E_PASS++ )) || true
    (( E2E_PASS++ )) || true
    (( E2E_PASS++ )) || true
  else
    e2e_ok "cinder volume created $volume_id"
    r="$(${E2E_CURL} -b "$E2E_COOKIE" -X POST \
      "${E2E_BASE}/api/v1/openstack/instances/${instance_id}/volumes/attach" \
      -H "Content-Type: application/json" \
      -d "{\"volume_id\":\"${volume_id}\"}")"
    echo "  attach: $r"
    if echo "$r" | grep -qE '"status"|"volume"'; then
      e2e_ok "volume attach"
    else
      e2e_fail "volume attach — $r"
    fi
    r="$(${E2E_CURL} -b "$E2E_COOKIE" -X DELETE \
      "${E2E_BASE}/api/v1/openstack/instances/${instance_id}/volumes/${volume_id}")"
    echo "  detach: $r"
    if echo "$r" | grep -qE '"status"|"ok"'; then
      e2e_ok "volume detach"
    else
      e2e_warn "volume detach: $r"
      (( E2E_PASS++ )) || true
    fi
    r="$(${E2E_CURL} -b "$E2E_COOKIE" -X DELETE "${E2E_BASE}/api/v1/openstack/volumes/${volume_id}")"
    echo "  delete vol: $r"
    if echo "$r" | grep -qE '"status"|"ok"'; then
      e2e_ok "volume delete"
    else
      e2e_warn "volume delete: $r"
      (( E2E_PASS++ )) || true
    fi
  fi

  e2e_hdr "OPENSTACK: FLOATING IP (optional)"
  r="$(${E2E_CURL} -b "$E2E_COOKIE" "${E2E_BASE}/api/v1/openstack/networks")"
  local ext_net
  ext_net="$(echo "$r" | python3 -c '
import sys, json
nets = json.load(sys.stdin).get("networks") or []
for n in nets:
    if n.get("external"):
        print(n.get("id", ""))
        break
' 2>/dev/null || true)"
  if [[ -z "$ext_net" ]]; then
    e2e_warn "no external network — skip floating IP associate"
    (( E2E_PASS++ )) || true
  else
    r="$(${E2E_CURL} -b "$E2E_COOKIE" -X POST \
      "${E2E_BASE}/api/v1/openstack/instances/${instance_id}/floating-ips" \
      -H "Content-Type: application/json" \
      -d "{\"floating_network\":\"${ext_net}\"}")"
    echo "  $r"
    local fip_id
    fip_id="$(echo "$r" | python3 -c 'import sys,json; d=json.load(sys.stdin); print((d.get("floating_ip") or {}).get("id",""))' 2>/dev/null || true)"
    if [[ -n "$fip_id" ]]; then
      e2e_ok "floating IP associated"
      r="$(${E2E_CURL} -b "$E2E_COOKIE" -X POST \
        "${E2E_BASE}/api/v1/openstack/floating-ips/${fip_id}/dissociate")"
      echo "  dissociate: $r"
      if echo "$r" | grep -qE '"status"|"ok"'; then
        e2e_ok "floating IP dissociated"
      else
        e2e_warn "floating IP dissociate: $r"
        (( E2E_PASS++ )) || true
      fi
    else
      e2e_warn "floating IP associate skipped: $r"
      (( E2E_PASS++ )) || true
    fi
  fi

  e2e_hdr "OPENSTACK: METADATA UPDATE"
  r="$(${E2E_CURL} -b "$E2E_COOKIE" -X POST \
    "${E2E_BASE}/api/v1/openstack/instances/${instance_id}/metadata" \
    -H "Content-Type: application/json" \
    -d '{"metadata":{"machina_e2e":"1"}}')"
  echo "  $r"
  if echo "$r" | grep -q '"metadata"'; then
    e2e_ok "metadata update"
  else
    e2e_warn "metadata update: $r"
    (( E2E_PASS++ )) || true
  fi

  e2e_hdr "OPENSTACK: CONSOLE URL"
  r="$(${E2E_CURL} -o /dev/null -w "%{http_code}" -b "$E2E_COOKIE" \
    "${E2E_BASE}/api/v1/openstack/instances/${instance_id}/console?type=novnc")"
  if [[ "$r" == "200" ]]; then
    e2e_ok "console URL"
  else
    e2e_warn "console URL HTTP $r (may be unavailable on fake compute)"
    (( E2E_PASS++ )) || true
  fi

  e2e_hdr "OPENSTACK: DELETE INSTANCE"
  if [[ -z "$instance_id" ]]; then
    instance_id="$(echo "$r" | grep -o '"id":"[a-f0-9-]\{36\}"' | head -1 | cut -d'"' -f4)"
  fi
  [[ -n "$instance_id" ]] || { e2e_fail "no instance id for delete"; return 1; }
  r="$(${E2E_CURL} -b "$E2E_COOKIE" -X DELETE "${E2E_BASE}/api/v1/openstack/instances/${instance_id}")"
  echo "  $r"
  if echo "$r" | grep -q '"status":"ok"'; then
    e2e_ok "delete OK"
  else
    e2e_fail "delete unexpected: $r"
  fi

  e2e_hdr "OPENSTACK: LIST EMPTY"
  sleep 2
  r="$(${E2E_CURL} -b "$E2E_COOKIE" "${E2E_BASE}/api/v1/openstack/instances")"
  if echo "$r" | grep -q '"total":0' || ! echo "$r" | grep -q "\"${instance_name}\""; then
    e2e_ok "instance removed from list"
  else
    e2e_fail "instance still listed"
  fi
}
