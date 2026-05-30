# Zeus OS AI batches AI-492–511 — Observability (Phase 31)

> Horizon phase 31. API trace spans, SLO evaluation, Prometheus gauges, and approval→apply hardening.

## AI-492–496 — Schema

[`controller/migrations/032_observability.sql`](../controller/migrations/032_observability.sql):

- `slo_policies` — api-availability, task-success, host-availability seeds
- `api_trace_spans` — per-request method/path/status/duration
- `ops_runbook_catalog.last_triggered_at` — scheduler cooldown for auto-triggers

## AI-497–501 — Engine + middleware

[`controller/src/engine/observability.rs`](../controller/src/engine/observability.rs):

- SLO evaluation from traces, tasks, and host state
- `record_trace` + rolling 5000-span retention
- Prometheus `machina_slo_*` and `machina_api_trace_p95_ms` gauges

[`controller/src/api/observability_middleware.rs`](../controller/src/api/observability_middleware.rs) — records `/api/v1/*` spans on protected routes.

## AI-502–504 — APIs

- `GET /api/v1/observability/overview`
- `GET /api/v1/observability/traces?limit=50`

## AI-505–507 — UI

[`PlatformObservability.tsx`](../web/src/pages/platform/PlatformObservability.tsx) — SLO dashboard + trace table.

## Hardening — approval→apply + scheduled runbooks

- [`approvals.rs`](../controller/src/engine/zeus_firewall/approvals.rs) — `approve_and_apply()` applies firewall profile on approve
- [`operations_scheduler.rs`](../controller/src/engine/operations_scheduler.rs) — 10-minute tick for catalog `auto_trigger` hints
- Firewall compliance UI shows apply result message on approve

## E2E

Section **OBSERVABILITY (AI-492–511)** in [`scripts/lib/e2e-platform-smoke.sh`](../scripts/lib/e2e-platform-smoke.sh).

## Out of scope

Distributed tracing (OTLP export), multi-window error budgets, PagerDuty SLO burn alerts.
