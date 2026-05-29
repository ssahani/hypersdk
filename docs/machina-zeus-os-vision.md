# Machina Zeus OS — AI-Native Infrastructure Operating System

**Machina** on the **Zeus** platform is not a VM manager or KVM dashboard. It is the infrastructure brain for private cloud: autonomous operations, fleet intelligence, FinOps, security, and intent-based provisioning — with Machina AI (Copilot, Doctor, Spotlight, Autopilot) as the operator layer.

> Zeus = enterprise virtualization platform · Machina = this product · Machina AI = intelligence features

**Status (main):** Layers 1–9 shipping in batches **AI-88–AI-121**. See [`platform-roadmap.md`](platform-roadmap.md).

---

## Positioning

| Not this | This |
|----------|------|
| VM Manager | Infrastructure Brain |
| KVM Dashboard | Autonomous Datacenter OS |
| Virtualization UI | AI Operations Platform |
| Script runner | Self-driving Cloud |

---

## Layer highlights (shipped)

| Layer | Capabilities |
|-------|----------------|
| Copilot / Intent | NL VM create, environment planner, mission stack plan + execute preview |
| Autonomous ops | SRE forecasts, root cause timeline, infrastructure memory + similar incidents |
| Digital Twin | Shutdown, migrate, network isolate blast simulation |
| Fleet | Heat map, rebalance propose/execute, GPU/NUMA placement advisor |
| Security | Graph, attack paths, CIS/PCI/SOC2/HIPAA frameworks |
| FinOps | Cost prediction, team attribution, chargeback CSV |
| Knowledge | Global search, NL diagnose ("why is billing slow") |
| Bare metal | Inventory, capacity plan, BMC power preview |
| Service fabric | Service graph, blast-radius impact simulation |

---

## API surface (phase 12)

- `POST /api/v1/ai/mission/stack/execute` — preview or enqueue GPU stack VMs
- `GET /api/v1/ai/cost/attribution/export.csv` — team chargeback CSV
- `GET /api/v1/ai/fleet/gpu-placement` — GPU/NUMA host ranking
- `POST /api/v1/ai/knowledge/diagnose` — NL infrastructure diagnosis
- `POST /api/v1/ai/services/impact` — service failure blast radius
- `GET /api/v1/ai/memory/similar` — similar incident recall

See [`zeus-os-vision.md`](zeus-os-vision.md) for Machina AI batches AI-49–AI-87 and phase 9–11 APIs in prior docs.
