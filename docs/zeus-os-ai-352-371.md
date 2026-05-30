# Zeus OS AI batches AI-352–371 — AI operator

> Phase 25. Guardrailed autonomous secure-machine preview with approval gates.

## AI-352–356 — Operator plan + thresholds

[`controller/src/engine/zeus_firewall/operator.rs`](../controller/src/engine/zeus_firewall/operator.rs):

- `GET /api/v1/zeus-firewall/operator/thresholds` — risk score, budget guard, auto-apply flag (off by default)
- `GET /api/v1/zeus-firewall/operator/plan` — fleet secure-machine previews with FinOps exposure overlap

## AI-354–355 — Execute stub

- `POST /api/v1/zeus-firewall/operator/execute` — dry-run or approval-gated execute; records `operator_secure` timeline event (stub enqueue)

## AI-359 — Mission Control strip

[`PlatformControlCenter.tsx`](../web/src/components/platform/PlatformControlCenter.tsx) shows AI operator summary when plan has eligible hosts.

## AI-360 — Spotlight

- `secure all hosts`, `ai operator`, `autonomous firewall` → Zeus Firewall

## E2E (AI-361)

Section **ZEUS FIREWALL PHASE 25** in [`scripts/lib/e2e-platform-smoke.sh`](../scripts/lib/e2e-platform-smoke.sh).

## Out of scope

Unattended live apply without approval, fleet-wide rollback automation, or LLM-driven rule authoring.
