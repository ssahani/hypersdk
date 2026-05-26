# Machina observability guide

Machina exposes host, VM, guest, fleet, and daemon telemetry for Linux KVM hypervisors.

## Quick endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/prometheus` | Prometheus text scrape (requires auth) |
| `GET /api/v1/metrics` | Live VM metrics (libvirt) |
| `GET /api/v1/metrics/history` | Ring buffer + optional JSONL persistence |
| `GET /api/v1/host/linux-observability` | PSI, diskstats, SMART, thermal, cgroups, bpftool summary |
| `GET /api/v1/host/linux-audit` | Recent auditd / `ausearch` events |
| `GET /api/v1/vms/{name}/guest-health` | Guest agent + metrics + issues |
| `GET /api/v1/fleet/metrics` | Multi-node host CPU/memory + capacity score |
| `GET /api/v1/fleet/alerts` | Aggregated automation alerts across fleet peers |
| `GET /api/v1/fleet/prometheus-targets` | Starter Prometheus `scrape_configs` for fleet |

## Prometheus

Scrape with a read-only API token:

```yaml
scrape_configs:
  - job_name: machina
    scheme: http
    metrics_path: /api/v1/prometheus
    static_configs:
      - targets: ['hypervisor.example:5092']
    authorization:
      type: Bearer
      credentials: '<mach_… token>'
```

Import `contrib/grafana/machina-overview.json` for starter dashboards.

## Metrics history (disk)

```toml
[metrics_history]
enabled = true
interval_secs = 30
max_points = 120
persist = true
max_file_mb = 32
# Optional: POST each sample as Machina JSON (NOT Prometheus remote_write protobuf)
remote_write_url = "https://metrics.example/ingest/machina"
remote_write_authorization = "Bearer …"
```

Each POST body is one [`MetricsHistoryPoint`](../../core/src/metrics_history.rs) object (`timestamp_ms`, host percentages, `vm_metrics`, …). Use a custom receiver, Grafana Alloy `http` input, or a small forwarder if you need Prometheus/Mimir native remote write.

File: `/var/lib/machina/metrics-history.jsonl`

## OTLP export

```toml
[observability.otlp]
enabled = true
endpoint = "http://127.0.0.1:4318"
interval_secs = 60
export_metrics = true
export_logs = true
export_traces = true
```

Compatible with OpenTelemetry Collector and Grafana Alloy (`/v1/metrics`, `/v1/logs`, `/v1/traces`). API responses include a W3C `traceparent` header; OTLP trace export uses random trace/span IDs per request.

Example alert rules: `contrib/prometheus/alerts.yaml`.

## Audit log shipping

```toml
[audit]
max_file_mb = 64
rotate_keep = 5
syslog_enabled = true
http_webhook_url = "https://your-ingest.example/audit"
webhook_authorization = "Bearer …"
sign_lines = true   # prefix each line with sha256:<hex> for tamper detection
```

## Linux auditd & eBPF

- **auditd:** `[observability.linux_audit]` + `GET /host/linux-audit`; set `health_avc_threshold` for `/health/problems`.
- **eBPF:** `bpftool` summary included in `linux-observability` and Prometheus (`machina_bpf_*`); no custom BPF programs shipped.

## Automation

Background worker evaluates alert rules, runs schedules, and fires webhooks on VM lifecycle events. Configure rules/channels in the UI **Settings → Automation** or via `/api/v1/automation/*`.

Prometheus gauges: `machina_alerts_unacknowledged`, `machina_alert_rules_enabled`, `machina_automation_last_tick_unix`, `machina_run_as_user_active`.

## Fleet

Enable `[fleet]` peers in config, then use `/fleet/status`, `/fleet/metrics`, `/fleet/alerts`, `/fleet/placement`, and `/fleet/prometheus-targets` for multi-hypervisor views.

`POST /api/v1/fleet/placement` ranks local + peer nodes by capacity headroom for a requested VM size (`vcpus`, `memory_mb`).

## Settings UI (admin)

**Settings → Observability** edits OTLP export, metrics JSON `remote_write_url`, and `audit.sign_lines` in `/etc/machina/config.toml` (workers reload without restart).

`POST /api/v1/fleet/create-vm` with `auto_place` and a create payload proxies VM creation to the best fleet peer (`peer: "local"` → use `POST /api/v1/vms` locally).

Example JSON ingest receiver: `contrib/ingest/machina-metrics-ingest.py`.

`GET /api/v1/audit/verify` checks `sha256:` prefixes on `/var/lib/machina/audit.log`. CLI: `./machinactl audit verify`.

## Alloy / Mimir

See `contrib/alloy/README.md` for scraping Prometheus and forwarding to a **native** `remote_write` endpoint (separate from Machina JSON ingest).
