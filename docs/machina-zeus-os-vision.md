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
| Guest / migration | GuestKit offline doctor, migrate-plan, worker jobs (LGPL) |
| Service fabric | Service graph, blast-radius impact |

---

## API surface (GuestKit / migration)

- `GET /api/v1/guestkit/status` — library version + worker reachability
- `POST /api/v1/guestkit/doctor` — offline boot probability (`image_path`, `target`)
- `POST /api/v1/guestkit/migrate-plan` — hypervisor-aware migration score
- `GET /api/v1/guestkit/vms/{id}/doctor` — resolve VM disk and run doctor
- `POST /api/v1/guestkit/jobs` — submit inspect job to GuestKit worker
- `GET /api/v1/migrations/advisor?disk_path=…` — blends heuristic + GuestKit scores

## Zeus Firewall (machine protection)

Zeus Firewall unifies host firewalls (firewalld, UFW, nftables, iptables) and optional PacketWolf traffic intelligence into one macOS-like control center under **Machine Security**.

- `GET /api/v1/zeus-firewall/status` — feature readiness (AI-142)
- `GET /api/v1/zeus-firewall/overview` — fleet posture cards
- `GET /api/v1/zeus-firewall/targets/{id}/ports` — open port exposure scanner
- `POST /api/v1/ai/firewall/secure-plan` — AI safe-machine plan
- `POST /api/v1/zeus-firewall/targets/{id}/lockdown` — Emergency Isolation

UI: `/platform/zeus/security/firewall` and related Machine Security views.

Daemon: `GET /api/v1/guestkit/status` proxies worker health when `[guestkit]` enabled in `config.toml`.

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
