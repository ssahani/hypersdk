# shellcheck shell=bash
# Read-only platform controller API smoke (direct :5093).

e2e_platform_smoke_get() {
  local path="$1" label="$2"
  local http r
  http="$(e2e_platform_http_code "${E2E_PLATFORM_BASE}${path}")"
  if [[ "$http" != "200" ]]; then
    e2e_platform_fail "${label} — HTTP ${http}"
    return 1
  fi
  r="$(e2e_platform_curl "${E2E_PLATFORM_BASE}${path}")"
  if [[ -z "$r" ]]; then
    e2e_platform_fail "${label} — empty body"
    return 1
  fi
  e2e_platform_ok "${label}"
  return 0
}

e2e_platform_smoke_run() {
  local endpoints=(
    "/api/v1/health"
    "/api/v1/health/ready"
    "/api/v1/hosts"
    "/api/v1/vms"
    "/api/v1/tasks"
    "/api/v1/placement/recommendations"
    "/api/v1/ha/status"
    "/api/v1/migrations"
    "/api/v1/fence/events"
    "/api/v1/storage/pools"
    "/api/v1/networks"
    "/api/v1/templates"
    "/api/v1/templates/marketplace"
    "/api/v1/reports/capacity"
    "/api/v1/projects"
    "/api/v1/notifications"
    "/api/v1/maintenance/schedules"
    "/api/v1/events"
    "/api/v1/audit"
    "/api/v1/cluster"
    "/api/v1/cluster/settings"
    "/api/v1/cluster/leadership"
    "/api/v1/enrollment/tokens"
    "/api/v1/webhooks"
    "/api/v1/api-keys"
    "/api/v1/users"
    "/api/v1/auth/oidc"
    "/api/v1/openapi.json"
    "/api/v1/policy/rules"
    "/api/v1/policy/quotas"
    "/api/v1/support/bundle"
    "/api/v1/upgrade/matrix"
    "/api/v1/backup-targets"
    "/api/v1/content/images"
    "/api/v1/recommendations"
    "/api/v1/applications"
    "/api/v1/topology"
    "/api/v1/blueprints"
    "/api/v1/reports/finops"
    "/api/v1/ai/settings"
    "/api/v1/ai/cost"
    "/api/v1/ai/capacity"
    "/api/v1/ai/security"
    "/api/v1/ai/compliance"
    "/api/v1/backups/timeline"
  )
  local ep host_id r http body

  e2e_platform_hdr "PLATFORM SMOKE: READ-ONLY GETs"
  for ep in "${endpoints[@]}"; do
    e2e_platform_smoke_get "$ep" "GET ${ep}" || true
  done

  e2e_platform_hdr "PLATFORM SMOKE: PROMETHEUS METRICS"
  http="$(e2e_platform_http_code "${E2E_PLATFORM_BASE}/api/v1/metrics/prometheus")"
  body="$(e2e_platform_curl "${E2E_PLATFORM_BASE}/api/v1/metrics/prometheus")"
  if [[ "$http" == "200" && -n "$body" && "$body" == *machina_platform* ]]; then
    e2e_platform_ok "GET /api/v1/metrics/prometheus"
  else
    e2e_platform_fail "GET /api/v1/metrics/prometheus — HTTP ${http}"
  fi

  e2e_platform_hdr "PLATFORM SMOKE: PLACEMENT REFRESH"
  r="$(e2e_platform_curl -X POST "${E2E_PLATFORM_BASE}/api/v1/placement/refresh")"
  echo "$r" | grep -q '\[' && e2e_platform_ok "POST /api/v1/placement/refresh" \
    || e2e_platform_fail "POST /api/v1/placement/refresh — got: $r"

  e2e_platform_hdr "PLATFORM SMOKE: VM METRICS & DISCOVERED FILTER"
  r="$(e2e_platform_curl "${E2E_PLATFORM_BASE}/api/v1/vms")"
  vm_id="$(echo "$r" | python3 -c "
import json, sys
try:
    vms = json.load(sys.stdin)
    print(vms[0]['id'] if vms else '')
except Exception:
    print('')
" 2>/dev/null)"
  if [[ -n "$vm_id" ]]; then
    http="$(e2e_platform_http_code "${E2E_PLATFORM_BASE}/api/v1/vms/${vm_id}/metrics")"
    if [[ "$http" == "200" || "$http" == "404" ]]; then
      e2e_platform_ok "GET /api/v1/vms/{id}/metrics (HTTP ${http})"
    else
      e2e_platform_fail "GET /api/v1/vms/{id}/metrics — HTTP ${http}"
    fi
    http="$(e2e_platform_curl -o /dev/null -w '%{http_code}' -X POST "${E2E_PLATFORM_BASE}/api/v1/vms/${vm_id}/health-check")"
    if [[ "$http" == "200" || "$http" == "400" ]]; then
      e2e_platform_ok "POST /api/v1/vms/{id}/health-check (HTTP ${http})"
    else
      e2e_platform_fail "POST /api/v1/vms/{id}/health-check — HTTP ${http}"
    fi
  else
    e2e_platform_warn "no VMs — skip vm metrics"
  fi
  http="$(e2e_platform_http_code "${E2E_PLATFORM_BASE}/api/v1/vms?managed=false")"
  [[ "$http" == "200" ]] && e2e_platform_ok "GET /api/v1/vms?managed=false" \
    || e2e_platform_fail "GET /api/v1/vms?managed=false — HTTP ${http}"

  e2e_platform_hdr "PLATFORM SMOKE: EVENTS SSE"
  if curl -sfS -N --max-time 3 -H "$(e2e_platform_auth_header)" "${E2E_PLATFORM_BASE}/api/v1/events/stream" | head -c 1 >/dev/null 2>&1; then
    e2e_platform_ok "GET /api/v1/events/stream (SSE reachable)"
  else
    e2e_platform_warn "SSE stream not verified (may need auth or timeout)"
  fi

  e2e_platform_hdr "PLATFORM SMOKE: HOST DETAIL"
  r="$(e2e_platform_curl "${E2E_PLATFORM_BASE}/api/v1/hosts")"
  host_id="$(echo "$r" | python3 -c "
import json, sys
try:
    hosts = json.load(sys.stdin)
    print(hosts[0]['id'] if hosts else '')
except Exception:
    print('')
" 2>/dev/null)"
  if [[ -n "$host_id" ]]; then
    e2e_platform_smoke_get "/api/v1/hosts/${host_id}/detail" "GET host detail" || true
  else
    e2e_platform_warn "no hosts — skip host detail"
  fi

  e2e_platform_hdr "PLATFORM SMOKE: ISO APPROVAL WORKFLOW"
  iso_name="e2e-iso-$(date +%s)"
  body="$(e2e_platform_curl -X POST "${E2E_PLATFORM_BASE}/api/v1/content/images" \
    -H 'Content-Type: application/json' \
    -d "{\"name\":\"${iso_name}\",\"path\":\"/tmp/${iso_name}\",\"kind\":\"iso\"}")"
  iso_id="$(echo "$body" | python3 -c "
import json, sys
try:
    print(json.load(sys.stdin).get('id',''))
except Exception:
    print('')
" 2>/dev/null)"
  if [[ -n "$iso_id" ]]; then
    echo "$body" | grep -q '"status":"pending"' && e2e_platform_ok "POST /api/v1/content/images → pending" \
      || e2e_platform_fail "POST /api/v1/content/images — expected pending status"
    http="$(e2e_platform_curl -o /dev/null -w '%{http_code}' -X POST "${E2E_PLATFORM_BASE}/api/v1/content/images/${iso_id}/approve")"
    if [[ "$http" == "200" ]]; then
      e2e_platform_ok "POST /api/v1/content/images/{id}/approve (HTTP ${http})"
    else
      e2e_platform_fail "POST /api/v1/content/images/{id}/approve — HTTP ${http}"
    fi
  else
    e2e_platform_warn "content create failed — skip ISO approval"
  fi

  e2e_platform_hdr "PLATFORM SMOKE: GUEST TOOLS & BLUEPRINTS"
  if [[ -n "$vm_id" ]]; then
    http="$(e2e_platform_curl -o /dev/null -w '%{http_code}' -X POST "${E2E_PLATFORM_BASE}/api/v1/vms/${vm_id}/guest-tools/install")"
    if [[ "$http" == "200" || "$http" == "400" ]]; then
      e2e_platform_ok "POST /api/v1/vms/{id}/guest-tools/install (HTTP ${http})"
    else
      e2e_platform_fail "POST /api/v1/vms/{id}/guest-tools/install — HTTP ${http}"
    fi
  fi
  bp_body="$(e2e_platform_curl -X POST "${E2E_PLATFORM_BASE}/api/v1/blueprints" \
    -H 'Content-Type: application/json' \
    -d '{"name":"e2e-bp-'"$(date +%s)"'","actions":["backup"],"vm_ids":[]}')"
  bp_id="$(echo "$bp_body" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)"
  if [[ -n "$bp_id" ]]; then
    e2e_platform_ok "POST /api/v1/blueprints"
  else
    e2e_platform_warn "blueprint create skipped"
  fi

  e2e_platform_hdr "PLATFORM SMOKE: TEMPLATE SEED"
  http="$(e2e_platform_curl -o /dev/null -w '%{http_code}' -X POST "${E2E_PLATFORM_BASE}/api/v1/templates/seed" -H 'Content-Type: application/json' -d '{}')"
  if [[ "$http" == "200" ]]; then
    e2e_platform_ok "POST /api/v1/templates/seed (HTTP ${http})"
  else
    e2e_platform_fail "POST /api/v1/templates/seed — HTTP ${http}"
  fi
  r="$(e2e_platform_curl "${E2E_PLATFORM_BASE}/api/v1/templates/marketplace")"
  echo "$r" | grep -q 'ubuntu-24.04' && e2e_platform_ok "marketplace has default templates" \
    || e2e_platform_warn "marketplace templates empty"

  e2e_platform_hdr "PLATFORM SMOKE: NETWORK DISCOVER"
  http="$(e2e_platform_curl -o /dev/null -w '%{http_code}' -X POST "${E2E_PLATFORM_BASE}/api/v1/networks/discover" -H 'Content-Type: application/json' -d '{}')"
  if [[ "$http" == "200" ]]; then
    e2e_platform_ok "POST /api/v1/networks/discover (HTTP ${http})"
  else
    e2e_platform_fail "POST /api/v1/networks/discover — HTTP ${http}"
  fi

  e2e_platform_hdr "PLATFORM SMOKE: STORAGE DISCOVER"
  http="$(e2e_platform_curl -o /dev/null -w '%{http_code}' -X POST "${E2E_PLATFORM_BASE}/api/v1/storage/pools/discover" -H 'Content-Type: application/json' -d '{}')"
  if [[ "$http" == "200" ]]; then
    e2e_platform_ok "POST /api/v1/storage/pools/discover (HTTP ${http})"
  else
    e2e_platform_fail "POST /api/v1/storage/pools/discover — HTTP ${http}"
  fi

  e2e_platform_hdr "PLATFORM SMOKE: TEMPLATE READINESS"
  http="$(e2e_platform_curl -o /dev/null -w '%{http_code}' "${E2E_PLATFORM_BASE}/api/v1/templates/ubuntu-24.04/1.0.0/readiness")"
  if [[ "$http" == "200" ]]; then
    e2e_platform_ok "GET /api/v1/templates/ubuntu-24.04/1.0.0/readiness (HTTP ${http})"
  else
    e2e_platform_fail "GET template readiness — HTTP ${http}"
  fi
  tpl_count="$(e2e_platform_curl "${E2E_PLATFORM_BASE}/api/v1/templates/marketplace" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo 0)"
  if [[ "$tpl_count" -ge 16 ]]; then
    e2e_platform_ok "marketplace has ${tpl_count} templates (expected 16+)"
  else
    e2e_platform_warn "marketplace has ${tpl_count} templates (expected 16)"
  fi

  e2e_platform_hdr "PLATFORM SMOKE: APPLICATION GROUPS"
  app_body="$(e2e_platform_curl -X POST "${E2E_PLATFORM_BASE}/api/v1/applications" \
    -H 'Content-Type: application/json' \
    -d '{"name":"Finance Application '"$(date +%s)"'","description":"E2E application group","vm_ids":[]}')"
  app_id="$(echo "$app_body" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)"
  if [[ -n "$app_id" ]]; then
    e2e_platform_ok "POST /api/v1/applications (friendly name with spaces)"
  else
    e2e_platform_fail "POST /api/v1/applications — got: $app_body"
  fi

  e2e_platform_hdr "PLATFORM SMOKE: MACHINA AI"
  e2e_platform_smoke_get "/api/v1/ai/settings" "GET /api/v1/ai/settings" || true
  e2e_platform_smoke_get "/api/v1/ai/cost" "GET /api/v1/ai/cost" || true
  e2e_platform_smoke_get "/api/v1/ai/capacity" "GET /api/v1/ai/capacity" || true
  e2e_platform_smoke_get "/api/v1/ai/security" "GET /api/v1/ai/security" || true
  http="$(e2e_platform_curl -o /dev/null -w '%{http_code}' -X POST "${E2E_PLATFORM_BASE}/api/v1/ai/spotlight" \
    -H 'Content-Type: application/json' -d '{"query":"show offline hosts"}')"
  if [[ "$http" == "200" ]]; then
    e2e_platform_ok "POST /api/v1/ai/spotlight (HTTP ${http})"
  else
    e2e_platform_fail "POST /api/v1/ai/spotlight — HTTP ${http}"
  fi
  http="$(e2e_platform_http_code "${E2E_PLATFORM_BASE}/api/v1/migrations/advisor?provider=vmware&vm=e2e-test")"
  if [[ "$http" == "200" ]]; then
    e2e_platform_ok "GET /api/v1/migrations/advisor (HTTP ${http})"
  else
    e2e_platform_fail "GET /api/v1/migrations/advisor — HTTP ${http}"
  fi
  if [[ -n "$vm_id" ]]; then
    http="$(e2e_platform_http_code "${E2E_PLATFORM_BASE}/api/v1/vms/${vm_id}/doctor")"
    if [[ "$http" == "200" ]]; then
      e2e_platform_ok "GET /api/v1/vms/{id}/doctor (HTTP ${http})"
    else
      e2e_platform_fail "GET /api/v1/vms/{id}/doctor — HTTP ${http}"
    fi
  else
    e2e_platform_warn "no VMs — skip doctor endpoint"
  fi
  e2e_platform_hdr "PLATFORM SMOKE: MACHINA AI V3"
  e2e_platform_hdr "PLATFORM SMOKE: MACHINA AI V4"
  http="$(e2e_platform_curl -o /dev/null -w '%{http_code}' -X POST "${E2E_PLATFORM_BASE}/api/v1/ai/terminal/suggest" \
    -H 'Content-Type: application/json' -d '{"vm_name":"test"}')"
  if [[ "$http" == "200" ]]; then
    e2e_platform_ok "POST /api/v1/ai/terminal/suggest (HTTP ${http})"
  else
    e2e_platform_fail "POST /api/v1/ai/terminal/suggest — HTTP ${http}"
  fi
  http="$(e2e_platform_http_code "${E2E_PLATFORM_BASE}/api/v1/ai/compliance/export")"
  if [[ "$http" == "200" ]]; then
    e2e_platform_ok "GET /api/v1/ai/compliance/export (HTTP ${http})"
  else
    e2e_platform_fail "GET /api/v1/ai/compliance/export — HTTP ${http}"
  fi
  http="$(e2e_platform_http_code "${E2E_PLATFORM_BASE}/api/v1/ai/autopilot/propose")"
  if [[ "$http" == "200" ]]; then
    e2e_platform_ok "GET /api/v1/ai/autopilot/propose (HTTP ${http})"
  else
    e2e_platform_fail "GET /api/v1/ai/autopilot/propose — HTTP ${http}"
  fi
  http="$(e2e_platform_http_code "${E2E_PLATFORM_BASE}/api/v1/ai/compliance")"
  if [[ "$http" == "200" ]]; then
    e2e_platform_ok "GET /api/v1/ai/compliance (HTTP ${http})"
  else
    e2e_platform_fail "GET /api/v1/ai/compliance — HTTP ${http}"
  fi
  http="$(e2e_platform_http_code "${E2E_PLATFORM_BASE}/api/v1/ai/policy/export")"
  if [[ "$http" == "200" ]]; then
    e2e_platform_ok "GET /api/v1/ai/policy/export (HTTP ${http})"
  else
    e2e_platform_fail "GET /api/v1/ai/policy/export — HTTP ${http}"
  fi
  e2e_platform_hdr "PLATFORM SMOKE: MACHINA AI V5"
  http="$(e2e_platform_curl -o /dev/null -w '%{http_code}' -X POST "${E2E_PLATFORM_BASE}/api/v1/ai/copilot/stream" \
    -H 'Content-Type: application/json' -d '{"message":"capacity"}')"
  if [[ "$http" == "200" ]]; then
    e2e_platform_ok "POST /api/v1/ai/copilot/stream (HTTP ${http})"
  else
    e2e_platform_fail "POST /api/v1/ai/copilot/stream — HTTP ${http}"
  fi
  http="$(e2e_platform_http_code "${E2E_PLATFORM_BASE}/api/v1/ai/compliance/export.pdf")"
  if [[ "$http" == "200" ]]; then
    e2e_platform_ok "GET /api/v1/ai/compliance/export.pdf (HTTP ${http})"
  else
    e2e_platform_fail "GET /api/v1/ai/compliance/export.pdf — HTTP ${http}"
  fi
  e2e_platform_hdr "PLATFORM SMOKE: MACHINA AI V6"
  http="$(e2e_platform_http_code "${E2E_PLATFORM_BASE}/api/v1/ai/autopilot/history")"
  if [[ "$http" == "200" ]]; then
    e2e_platform_ok "GET /api/v1/ai/autopilot/history (HTTP ${http})"
  else
    e2e_platform_fail "GET /api/v1/ai/autopilot/history — HTTP ${http}"
  fi
  http="$(e2e_platform_http_code "${E2E_PLATFORM_BASE}/api/v1/ai/cost/export.csv")"
  if [[ "$http" == "200" ]]; then
    e2e_platform_ok "GET /api/v1/ai/cost/export.csv (HTTP ${http})"
  else
    e2e_platform_fail "GET /api/v1/ai/cost/export.csv — HTTP ${http}"
  fi
}
