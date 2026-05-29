# Machina Zeus OS — AI-Native Infrastructure Operating System

**Machina** on the **Zeus** platform is not a VM manager or KVM dashboard. It is the infrastructure brain for private cloud: autonomous operations, fleet intelligence, FinOps, security, and intent-based provisioning — with Machina AI (Copilot, Doctor, Spotlight, Autopilot) as the operator layer.

> Zeus = enterprise virtualization platform · Machina = this product · Machina AI = intelligence features

**Status (main):** Layers 1–9 shipping in batches **AI-88–AI-113**. See [`platform-roadmap.md`](platform-roadmap.md).

---

## Positioning

| Not this | This |
|----------|------|
| VM Manager | Infrastructure Brain |
| KVM Dashboard | Autonomous Datacenter OS |
| Virtualization UI | AI Operations Platform |
| Script runner | Self-driving Cloud |

Machina already spans: libvirt/KVM control, Zyvor Platform, OpenStack, fleet, observability, automation, backups, migration, and Machina AI — a **private cloud control plane**, not a single-host UI.

---

## Layer 1 — AI Infrastructure Copilot

**Shipped:** NL VM create, cost/capacity, Spotlight, Copilot, Blueprint Studio, environment intent, mission stack preview.

---

## Layer 2 — Autonomous Operations

**Shipped:** AI SRE forecasts, root cause + infrastructure timeline, Mission Control stack builder.

---

## Layer 3 — Digital Twin

**Shipped (AI-89, AI-106):**

- Live graph: host → VM → storage → network
- **Impact simulation** — shutdown host, evacuate/migrate host, isolate network blast radius

---

## Layer 4 — Fleet Intelligence

**Shipped (AI-96–AI-97, AI-108):** Fleet heat map, rebalance proposals, execute preview + admin enqueue for live migrations.

---

## Layer 5 — AI Security

**Shipped (AI-98–AI-99, AI-109):** Security graph, attack paths, compliance framework mapping (CIS, PCI, SOC2, HIPAA).

---

## Layer 6 — FinOps

**Shipped (AI-94, AI-107):** Next-month cost prediction, per-team/project attribution from tags and project fields.

---

## Layer 7 — Infrastructure Knowledge Engine

**Shipped (AI-100):** Global search across VMs, networks, alerts, logs, incidents, audit.

---

## Layer 8 — Bare Metal Cloud

**Shipped (AI-104, AI-110):** Bare metal inventory, capacity planning, BMC power lifecycle preview (Redfish/IPMI live calls on roadmap).

---

## Layer 9 — AI Datacenter Fabric

**Shipped (AI-101–AI-103):** Service graph, infrastructure memory, AI Mission Stack.

---

## API surface (phase 9–11)

**Phase 9–10** — see prior batches AI-88–AI-105.

**Phase 11**
- `POST /api/v1/ai/twin/impact` — migrate host + isolate network actions
- `GET /api/v1/ai/cost/attribution` — team/project FinOps breakdown
- `POST /api/v1/ai/fleet/rebalance/execute` — preview or enqueue rebalance migrations
- `GET /api/v1/ai/compliance/frameworks` — CIS/PCI/SOC2/HIPAA control mapping
- `POST /api/v1/baremetal/servers/{id}/power` — BMC on/off/cycle (preview)

See also [`zeus-os-vision.md`](zeus-os-vision.md) for Zeus platform context and Machina AI batches AI-49–AI-87.
