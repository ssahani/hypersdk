# Machina implementation roadmap (15 phases)

Phases below were delivered on `main` in batches through observability, integrations, and hardening work.

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | Per-vCPU / IOPS VM metrics + Prometheus | Done |
| 2 | HTTP latency histograms + trace buffer | Done |
| 3 | Metrics history (memory + JSONL + JSON remote POST) | Done |
| 4 | OTLP metrics/logs/traces + hot-reload workers | Done |
| 5 | Audit signing + verify API + machinactl | Done |
| 6 | Fleet capacity, alerts, placement, create-on-peer | Done |
| 7 | Grafana overview + Alertmanager examples | Done |
| 8 | OIDC run-as-user (sudo / polkit / setuid helper) | Done |
| 9 | macOS daemon build (Linux-only PAM) | Done |
| 10 | K8s `kubectl top` metrics API + UI panel | Done |
| 11 | `GET /integrations/status` + Settings panel | Done |
| 12 | Core `k8s_top` parser tests + fleet placement tests | Done |
| 13 | Prometheus integration gauges + Grafana v4 | Done |
| 14 | Metrics traces API, batch ingest, Prometheus text ingest | Done |
| 15 | machinactl integrations, health probes, example config, ROADMAP | Done |

## Follow-ups (not numbered phases)

- Full Prometheus **protobuf** remote_write receiver (today: JSON + text exposition ingest)
- Broader run-as-user (libvirt session automation beyond create default)
- Multi-host fleet metrics aggregation in one scrape

See `docs/guides/observability.md` and `docs/guides/integrations.md`.
