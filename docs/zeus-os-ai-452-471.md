# Zeus OS AI batches AI-452–471 — Operations runbooks + compliance showback

> Horizon phase 29. Runbook catalog, execution history, and project showback rollup.

## AI-452–456 — Schema

[`controller/migrations/031_operations.sql`](../controller/migrations/031_operations.sql):

- `ops_runbook_catalog` — incident playbooks with auto-trigger hints
- `ops_runbook_executions` — execution audit trail
- `ops_showback_snapshots` — project cost + compliance grade snapshots

## AI-457–460 — Engine + APIs

[`controller/src/engine/operations.rs`](../controller/src/engine/operations.rs):

- `GET /api/v1/operations/overview`
- `GET /api/v1/operations/runbooks`
- `POST /api/v1/operations/runbooks/{incident}/execute` — delegates to existing runbook generator
- `GET /api/v1/operations/executions`
- `GET /api/v1/operations/showback`

## AI-461–463 — UI

[`PlatformReports.tsx`](../web/src/pages/platform/PlatformReports.tsx) — **Reports | Runbooks | Showback** tabs.

## E2E

Section **OPERATIONS (AI-452–471)** in [`scripts/lib/e2e-platform-smoke.sh`](../scripts/lib/e2e-platform-smoke.sh).

## Out of scope

Scheduled runbook cron, ITSM ticket integration, live chargeback billing export.
