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
# Optional: POST each sample JSON to a metrics gateway or custom ingest
remote_write_url = "https://metrics.example/ingest/machina"
remote_write_authorization = "Bearer …"
```

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

Compatible with OpenTelemetry Collector and Grafana Alloy (`/v1/metrics`, `/v1/logs`, `/v1/traces`).

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

Prometheus gauges: `machina_alerts_unacknowledged`, `machina_alert_rules_enabled`.

## Fleet

Enable `[fleet]` peers in config, then use `/fleet/status`, `/fleet/metrics`, and `/fleet/prometheus-targets` for multi-hypervisor views.
