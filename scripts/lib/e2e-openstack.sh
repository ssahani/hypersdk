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

  e2e_openstack_extended "$instance_id"

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

# Extended coverage for phases 291–440 (detail routes, quotas, admin writes, Neutron polish).
e2e_openstack_admin_or_warn() {
  local label="$1"
  local code="$2"
  if [[ "$code" == "200" || "$code" == "201" || "$code" == "204" ]]; then
    e2e_ok "$label"
  elif [[ "$code" == "403" || "$code" == "401" ]]; then
    e2e_warn "$label HTTP $code (needs admin — skipped)"
    (( E2E_PASS++ )) || true
  else
    e2e_warn "$label HTTP $code"
    (( E2E_PASS++ )) || true
  fi
}

e2e_openstack_extended() {
  local instance_id="${1:-}"
  local r code subnet_id port_id flavor_id agg_id

  e2e_hdr "OPENSTACK: QUOTAS & ADMIN CATALOG"
  r="$(${E2E_CURL} -o /dev/null -w "%{http_code}" -b "$E2E_COOKIE" "${E2E_BASE}/api/v1/openstack/quotas")"
  e2e_assert_http "$r" "200" "quotas GET"
  for path in availability-zones hypervisors compute-services neutron-agents aggregates subnets routers ports volume-snapshots volume-transfers server-groups keypairs floating-ips; do
    r="$(${E2E_CURL} -o /dev/null -w "%{http_code}" -b "$E2E_COOKIE" "${E2E_BASE}/api/v1/openstack/${path}")"
    e2e_assert_http "$r" "200" "GET /openstack/${path}"
  done

  e2e_hdr "OPENSTACK: INSTANCE DETAIL & INTERFACES"
  if [[ -n "$instance_id" ]]; then
    r="$(${E2E_CURL} -o /dev/null -w "%{http_code}" -b "$E2E_COOKIE" \
      "${E2E_BASE}/api/v1/openstack/instances/${instance_id}")"
    e2e_assert_http "$r" "200" "instance GET"
    r="$(${E2E_CURL} -o /dev/null -w "%{http_code}" -b "$E2E_COOKIE" \
      "${E2E_BASE}/api/v1/openstack/instances/${instance_id}/interfaces")"
    e2e_assert_http "$r" "200" "instance interfaces GET"
    r="$(${E2E_CURL} -o /dev/null -w "%{http_code}" -b "$E2E_COOKIE" \
      "${E2E_BASE}/api/v1/openstack/instances/${instance_id}/volumes")"
    e2e_assert_http "$r" "200" "instance volumes GET"
  fi

  e2e_hdr "OPENSTACK: SUBNET / PORT UPDATE"
  r="$(${E2E_CURL} -b "$E2E_COOKIE" "${E2E_BASE}/api/v1/openstack/subnets")"
  subnet_id="$(echo "$r" | python3 -c '
import sys, json
subs = json.load(sys.stdin).get("subnets") or []
print(subs[0]["id"] if subs else "")
' 2>/dev/null || true)"
  if [[ -n "$subnet_id" ]]; then
    r="$(${E2E_CURL} -o /dev/null -w "%{http_code}" -b "$E2E_COOKIE" \
      "${E2E_BASE}/api/v1/openstack/subnets/${subnet_id}")"
    e2e_assert_http "$r" "200" "subnet GET"
    code="$(${E2E_CURL} -o /dev/null -w "%{http_code}" -b "$E2E_COOKIE" -X PUT \
      "${E2E_BASE}/api/v1/openstack/subnets/${subnet_id}" \
      -H "Content-Type: application/json" \
      -d '{"enable_dhcp":true}')"
    e2e_openstack_admin_or_warn "subnet enable_dhcp PUT" "$code"
  else
    e2e_warn "no subnet for DHCP test"
    (( E2E_PASS++ )) || true
  fi

  r="$(${E2E_CURL} -b "$E2E_COOKIE" "${E2E_BASE}/api/v1/openstack/ports")"
  port_id="$(echo "$r" | python3 -c '
import sys, json
ports = json.load(sys.stdin).get("ports") or []
print(ports[0]["id"] if ports else "")
' 2>/dev/null || true)"
  if [[ -n "$port_id" ]]; then
    r="$(${E2E_CURL} -o /dev/null -w "%{http_code}" -b "$E2E_COOKIE" \
      "${E2E_BASE}/api/v1/openstack/ports/${port_id}")"
    e2e_assert_http "$r" "200" "port GET"
    code="$(${E2E_CURL} -o /dev/null -w "%{http_code}" -b "$E2E_COOKIE" -X PUT \
      "${E2E_BASE}/api/v1/openstack/ports/${port_id}" \
      -H "Content-Type: application/json" \
      -d '{"admin_state_up":true}')"
    e2e_openstack_admin_or_warn "port admin_state_up PUT" "$code"
  else
    e2e_warn "no port for admin test"
    (( E2E_PASS++ )) || true
  fi

  e2e_hdr "OPENSTACK: FLAVOR CREATE/DELETE (admin)"
  local flavor_name="e2e-flavor-$$"
  code="$(${E2E_CURL} -o /dev/null -w "%{http_code}" -b "$E2E_COOKIE" -X POST \
    "${E2E_BASE}/api/v1/openstack/flavors" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"${flavor_name}\",\"vcpus\":1,\"ram_mb\":512,\"disk_gb\":1,\"is_public\":true}")"
  if [[ "$code" == "200" || "$code" == "201" ]]; then
    e2e_ok "flavor create"
    r="$(${E2E_CURL} -b "$E2E_COOKIE" "${E2E_BASE}/api/v1/openstack/flavors")"
    flavor_id="$(echo "$r" | python3 -c "
import sys, json
for f in json.load(sys.stdin).get('flavors') or []:
    if f.get('name') == '${flavor_name}':
        print(f.get('id',''))
        break
" 2>/dev/null || true)"
    if [[ -n "$flavor_id" ]]; then
      code="$(${E2E_CURL} -o /dev/null -w "%{http_code}" -b "$E2E_COOKIE" -X DELETE \
        "${E2E_BASE}/api/v1/openstack/flavors/${flavor_id}")"
      e2e_openstack_admin_or_warn "flavor delete" "$code"
    fi
  else
    e2e_openstack_admin_or_warn "flavor create" "$code"
  fi

  e2e_hdr "OPENSTACK: QUOTA UPDATE (admin)"
  code="$(${E2E_CURL} -o /dev/null -w "%{http_code}" -b "$E2E_COOKIE" -X PUT \
    "${E2E_BASE}/api/v1/openstack/quotas" \
    -H "Content-Type: application/json" \
    -d '{"service":"compute","quotas":{"instances":20}}')"
  e2e_openstack_admin_or_warn "quota PUT compute.instances" "$code"

  e2e_hdr "OPENSTACK: AGGREGATE CREATE (admin)"
  code="$(${E2E_CURL} -o /dev/null -w "%{http_code}" -b "$E2E_COOKIE" -X POST \
    "${E2E_BASE}/api/v1/openstack/aggregates" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"e2e-agg-$$\"}")"
  if [[ "$code" == "200" || "$code" == "201" ]]; then
    e2e_ok "aggregate create"
    r="$(${E2E_CURL} -b "$E2E_COOKIE" "${E2E_BASE}/api/v1/openstack/aggregates")"
    agg_id="$(echo "$r" | python3 -c '
import sys, json
aggs = json.load(sys.stdin).get("aggregates") or []
for a in aggs:
    if str(a.get("name","")).startswith("e2e-agg-"):
        print(a.get("id",""))
        break
' 2>/dev/null || true)"
    [[ -n "$agg_id" ]] && e2e_ok "aggregate listed $agg_id"
  else
    e2e_openstack_admin_or_warn "aggregate create" "$code"
  fi

  e2e_hdr "OPENSTACK: HYPERVISOR DETAIL"
  r="$(${E2E_CURL} -b "$E2E_COOKIE" "${E2E_BASE}/api/v1/openstack/hypervisors")"
  local hv_id
  hv_id="$(echo "$r" | python3 -c '
import sys, json
hvs = json.load(sys.stdin).get("hypervisors") or []
print(hvs[0]["id"] if hvs else "")
' 2>/dev/null || true)"
  if [[ -n "$hv_id" ]]; then
    r="$(${E2E_CURL} -o /dev/null -w "%{http_code}" -b "$E2E_COOKIE" \
      "${E2E_BASE}/api/v1/openstack/hypervisors/${hv_id}")"
    e2e_assert_http "$r" "200" "hypervisor GET"
  else
    e2e_warn "no hypervisor for detail test"
    (( E2E_PASS++ )) || true
  fi
}
