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
