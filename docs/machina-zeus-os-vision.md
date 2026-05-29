# Machina Zeus OS — AI-Native Infrastructure Operating System

**Machina** on the **Zeus** platform is not a VM manager or KVM dashboard. It is the infrastructure brain for private cloud: autonomous operations, fleet intelligence, FinOps, security, and intent-based provisioning — with Machina AI (Copilot, Doctor, Spotlight, Autopilot) as the operator layer.

> Zeus = enterprise virtualization platform · Machina = this product · Machina AI = intelligence features

**Status (main):** Layers 1–9 shipping in batches **AI-88–AI-105**. See [`platform-roadmap.md`](platform-roadmap.md).

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

**Shipped:** NL VM create, cost/capacity, Spotlight, Copilot, Blueprint Studio.

**Shipped (AI-88–AI-90):**

- **AI Mission Control** — NL environment builder (`staging for 20 developers`, GPU cluster preview)
- **Intent Engine** — calculates CPU, memory, storage, network, backup policy, cost from natural language
- No YAML / Terraform / Ansible for default paths — review card → execute

---

## Layer 2 — Autonomous Operations

**Shipped (AI-91–AI-93):**

- **AI SRE** — predicts memory/CPU/storage exhaustion from live metrics
- **AI Root Cause** — correlates audit, events, tasks into timeline + hypothesis + confidence
- **Infrastructure Timeline** — Git-style history for datacenter changes (Mission Control UI)

---

## Layer 3 — Digital Twin

**Shipped (AI-89):**

- Live graph: host → VM → storage → network
- **Impact simulation** — “What breaks if I shut down this host?”
- Foundation for full simulation (migrate, network blast radius) in later batches

---

## Layer 4 — Fleet Intelligence

**Shipped:** Daemon fleet APIs, Machina AI fleet summary (v8).

**Shipped (AI-96–AI-97):** Fleet heat map (hot/cold/power waste), AI rebalance proposals (DRS-class placement).

---

## Layer 5 — AI Security

**Shipped:** Security Sentinel, compliance export, Network Lens.

**Shipped (AI-98–AI-99):** Security graph (users, hosts, VMs, networks, API keys), attack path queries.

---

## Layer 6 — FinOps

**Shipped:** Cost Guardian, CFO CSV, idle/oversized detection.

**Shipped (AI-94):** Next-month cost prediction. Per-team attribution on roadmap.

---

## Layer 7 — Infrastructure Knowledge Engine

**Shipped (AI-100):** Global search across VMs, networks, alerts, logs, incidents, audit — one query surface.

---

## Layer 8 — Bare Metal Cloud

**Shipped (AI-104):** Bare metal inventory API, capacity planning preview (PXE/Redfish/IPMI lifecycle on roadmap).

---

## Layer 9 — AI Datacenter Fabric

**Shipped (AI-101–AI-103):** Service graph (VM → container → service → DB), infrastructure memory across incidents, AI Mission Stack (GPU/K8s/inference preview).

---

## Three killer features (priority)

1. **Infrastructure Digital Twin** — AI-89 (shipped)
2. **AI Root Cause Engine** — AI-92 (shipped)
3. **Intent-Based Infrastructure** — AI-90 (shipped)

These move Machina from virtualization platform to **AI-native Infrastructure OS**.

---

## API surface (phase 9–10)

**Phase 9**
- `GET /api/v1/ai/twin/graph` — digital twin graph
- `POST /api/v1/ai/twin/impact` — blast-radius simulation
- `GET /api/v1/ai/incidents/analyze` — root cause + timeline
- `POST /api/v1/ai/intent/environment` — NL environment plan
- `GET /api/v1/ai/sre/forecast` — proactive exhaustion forecasts

**Phase 10**
- `GET /api/v1/ai/fleet/heatmap` — fleet hot/cold classification
- `GET /api/v1/ai/fleet/rebalance/propose` — DRS-style rebalance proposals
- `GET /api/v1/ai/security/graph` — security relationship graph
- `POST /api/v1/ai/security/attack-path` — attack path analysis
- `POST /api/v1/ai/knowledge/search` — unified infrastructure search
- `GET /api/v1/ai/services/graph` — service dependency graph
- `GET /api/v1/ai/memory/incidents` — incident recall from audit
- `POST /api/v1/ai/mission/stack` — NL GPU/K8s/inference stack plan
- `GET/POST /api/v1/baremetal/servers` — bare metal inventory
- `POST /api/v1/baremetal/capacity/plan` — bare metal capacity plan

See also [`zeus-os-vision.md`](zeus-os-vision.md) for Zeus platform context and Machina AI batches AI-49–AI-87.
