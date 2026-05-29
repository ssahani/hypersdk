# Machina Zeus OS — AI-Native Infrastructure Operating System

**Machina** on the **Zeus** platform — infrastructure brain for private cloud with Machina AI as the operator layer.

**Status (main):** Layers 1–9 shipping in batches **AI-88–AI-137**. See [`platform-roadmap.md`](platform-roadmap.md).

---

## Layer highlights (shipped)

| Layer | Capabilities |
|-------|----------------|
| Copilot / Intent | NL environments (plan + execute), mission stack, Spotlight |
| Autonomous ops | SRE forecast + remediations, root cause, memory recall |
| Digital Twin | Shutdown, migrate, network isolate, storage drain simulation |
| Fleet | Heat map, rebalance, GPU placement, power optimizer |
| Security | Graph, attack paths, compliance frameworks + remediations |
| FinOps | Prediction, attribution, chargeback CSV, budget guard |
| Knowledge | Search, NL diagnose, runbook generation |
| Bare metal | Inventory, BMC power, PXE provision preview |
| Service fabric | Service graph, blast-radius impact |

---

## API surface (phase 14)

- `GET /api/v1/ai/remediate/hub` — unified SRE, compliance, and fleet power remediation queue
- `POST /api/v1/ai/knowledge/runbook` — NL diagnose + operator runbook steps
- `GET /api/v1/ai/cost/budget` — monthly budget vs spend alerts
- `GET /api/v1/ai/mission/stack/status` — track GPU and environment stack VMs
- `POST /api/v1/ai/twin/impact` — storage pool drain blast-radius (target_kind `storage`)

## API surface (phase 13)

- `POST /api/v1/ai/intent/environment/execute` — preview or enqueue environment VMs
- `GET /api/v1/ai/sre/remediate` — proactive fixes from SRE forecasts
- `GET /api/v1/ai/compliance/remediate` — framework control remediations
- `GET /api/v1/ai/zeus/summary` — unified OS health strip
- `GET /api/v1/ai/fleet/power/optimize` — power waste / consolidation savings
- `GET /api/v1/baremetal/servers/{id}/provision` — PXE provision workflow preview

Phase 9–12 APIs documented in prior roadmap batches.
