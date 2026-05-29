# Machina Zeus OS — AI-Native Infrastructure Operating System

**Machina** on the **Zeus** platform — infrastructure brain for private cloud with Machina AI as the operator layer.

**Status (main):** Layers 1–9 shipping in batches **AI-88–AI-129**. See [`platform-roadmap.md`](platform-roadmap.md).

---

## Layer highlights (shipped)

| Layer | Capabilities |
|-------|----------------|
| Copilot / Intent | NL environments (plan + execute), mission stack, Spotlight |
| Autonomous ops | SRE forecast + remediations, root cause, memory recall |
| Digital Twin | Shutdown, migrate, network isolate simulation |
| Fleet | Heat map, rebalance, GPU placement, power optimizer |
| Security | Graph, attack paths, compliance frameworks + remediations |
| FinOps | Prediction, attribution, chargeback CSV |
| Knowledge | Search, NL diagnose |
| Bare metal | Inventory, BMC power, PXE provision preview |
| Service fabric | Service graph, blast-radius impact |

---

## API surface (phase 13)

- `POST /api/v1/ai/intent/environment/execute` — preview or enqueue environment VMs
- `GET /api/v1/ai/sre/remediate` — proactive fixes from SRE forecasts
- `GET /api/v1/ai/compliance/remediate` — framework control remediations
- `GET /api/v1/ai/zeus/summary` — unified OS health strip
- `GET /api/v1/ai/fleet/power/optimize` — power waste / consolidation savings
- `GET /api/v1/baremetal/servers/{id}/provision` — PXE provision workflow preview

Phase 9–12 APIs documented in prior roadmap batches.
