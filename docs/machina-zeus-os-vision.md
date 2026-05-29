# Machina Zeus OS — AI-Native Infrastructure Operating System

**Machina** on the **Zeus** platform is not a VM manager or KVM dashboard. It is the infrastructure brain for private cloud: autonomous operations, fleet intelligence, FinOps, security, and intent-based provisioning — with Machina AI (Copilot, Doctor, Spotlight, Autopilot) as the operator layer.

> Zeus = enterprise virtualization platform · Machina = this product · Machina AI = intelligence features

**Status (main):** Layers 1–2 foundations shipping in batches **AI-88–AI-95**. See [`platform-roadmap.md`](platform-roadmap.md).

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

**Next (AI-88–AI-90):**

- **AI Mission Control** — NL environment builder (`staging for 20 developers`, GPU cluster preview)
- **Intent Engine** — calculates CPU, memory, storage, network, backup policy, cost from natural language
- No YAML / Terraform / Ansible for default paths — review card → execute

---

## Layer 2 — Autonomous Operations

**Shipping (AI-91–AI-93):**

- **AI SRE** — predicts memory/CPU/storage exhaustion from live metrics
- **AI Root Cause** — correlates audit, events, tasks into timeline + hypothesis + confidence
- **Infrastructure Timeline** — Git-style history for datacenter changes (Mission Control UI)

---

## Layer 3 — Digital Twin

**Shipping (AI-89):**

- Live graph: host → VM → storage → network
- **Impact simulation** — “What breaks if I shut down this host?”
- Foundation for full simulation (migrate, network blast radius) in AI-96+

---

## Layer 4 — Fleet Intelligence

**Shipped:** Daemon fleet APIs, Machina AI fleet summary (v8).

**Next:** Fleet heat map, AI placement (NUMA, locality, GPU), autonomous rebalancer (DRS-class).

---

## Layer 5 — AI Security

**Shipped:** Security Sentinel, compliance export, Network Lens.

**Next:** Security graph, attack path queries, continuous CIS/PCI/SOC2/HIPAA checks.

---

## Layer 6 — FinOps

**Shipped:** Cost Guardian, CFO CSV, idle/oversized detection.

**Shipping (AI-94):** Next-month cost prediction, per-team attribution (roadmap).

---

## Layer 7 — Infrastructure Knowledge Engine

**Next:** Global search across VMs, networks, alerts, logs, incidents; “Why is billing slow?” from one graph.

---

## Layer 8 — Bare Metal Cloud

**Next:** PXE, Redfish, IPMI, BMC lifecycle inside Machina (Metal³ / KubeVirt adjacency).

---

## Layer 9 — AI Datacenter Fabric

**Next:** Service graph (VM → container → service → DB), infrastructure memory across incidents.

---

## Three killer features (priority)

1. **Infrastructure Digital Twin** — AI-89 (shipping)
2. **AI Root Cause Engine** — AI-92 (shipping)
3. **Intent-Based Infrastructure** — AI-90 (shipping)

These move Machina from virtualization platform to **AI-native Infrastructure OS**.

---

## API surface (phase 9)

- `GET /api/v1/ai/twin/graph` — digital twin graph
- `POST /api/v1/ai/twin/impact` — blast-radius simulation
- `GET /api/v1/ai/incidents/analyze` — root cause + timeline
- `POST /api/v1/ai/intent/environment` — NL environment plan
- `GET /api/v1/ai/sre/forecast` — proactive exhaustion forecasts

See also [`zeus-os-vision.md`](zeus-os-vision.md) for Zeus platform context and Machina AI batches AI-49–AI-87.
