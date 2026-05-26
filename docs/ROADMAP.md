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
| 14 | Metrics traces API, batch ingest, Prometheus text + **remote_write protobuf** ingest | Done |
| 15 | machinactl integrations, health probes, example config, ROADMAP | Done |

## Follow-ups (delivered)

| Item | Status |
|------|--------|
| Prometheus remote_write **2.0** (`Content-Type: application/x-protobuf; proto=io.prometheus.write.v2.Request`) | Done — auto-detected alongside v1 `WriteRequest` on `POST /metrics/ingest/remote-write` |
| Broader run-as-user session libvirt | Done — `prefer_session_libvirt_on_impersonation` applies to VM list/lifecycle/snapshot routes via `spawn_libvirt_actor` |
| Multi-host fleet Prometheus in one scrape | Done — `GET /api/v1/fleet/prometheus` merges local + peer `/prometheus` with `machina_peer` label |

See `docs/guides/observability.md` and `docs/guides/integrations.md`.
