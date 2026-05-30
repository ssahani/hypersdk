# Backend ↔ UX wiring audit

Last updated: 2026-05-30

This document is an honest inventory of how much controller/daemon surface area is reachable from the **Platform desktop** (`/platform/*`) versus legacy or separate UIs.

## Summary

| Layer | Approx. count | Wired to Platform UX |
|-------|---------------|----------------------|
| Controller HTTP routes (`controller/src/api/mod.rs`) | ~290 | ~15–20% have a dedicated Platform page/tab |
| TypeScript API clients (`web/src/api/*`) | ~400+ exports | ~35% imported by at least one page |
| Full product UIs | 4 shells | Platform, Classic (`/`), OpenStack (`/openstack/*`), K8s (`/k8s/*`) |

**Your intuition is directionally correct:** most backend code exists for power users, agents, and future surfaces. The Platform desktop intentionally shows a **small Normal tier**; Advanced exposes more but still does not mirror every route.

## What is wired today

### Platform desktop (Normal tier — default for new users)

- Dashboard, VMs, Hosts, Storage, Backups, Settings, Support, Notifications
- **Apps & Integrations** hub → OpenStack, K8s, HyperSDK, GuestKit, classic UI (when daemon flags enable them)
- Dock-first layout; sidebar collapsed/hidden

### Platform desktop (Power / Advanced)

- Everything in Normal plus networks, Zeus, tasks, migration, firewall modules, policy, observability, fleet settings strips, etc.
- See [machina-infrastructure-vision.md](./machina-infrastructure-vision.md) API ↔ UI map

### Separate shells (not missing — different entry point)

| UI | Path | Backend |
|----|------|---------|
| OpenStack operator | `/openstack/*` | OpenStack API proxy + Heat, Neutron, Nova pages |
| Kubernetes / KubeVirt | `/k8s/*` | KubeVirt exec API |
| Classic Machina | `/`, `/vms`, `/storage`, … | Daemon REST (original UI) |

OpenStack was never deleted; it was **not linked from Platform** until the Integrations hub. Enable `openstack.enabled` in daemon config to see it on `/platform/integrations`.

## Major gaps (next wiring phases)

### P6 — Integrations bridge (in progress)

- [x] `/platform/integrations` hub
- [x] Sidebar / Go menu / Control Center links when capabilities enabled
- [ ] Embed OpenStack overview iframe/panel inside Platform (optional)
- [ ] Single sign-on context banner when leaving Platform shell

### P7 — Classic → Platform parity

Routes heavily used in classic UI but thin in Platform:

- Node/host deep tools (`/node/*`, libvirt filters, NW filters)
- Import wizard (`/import`) — link from Integrations only today
- Marketplace / plugins
- Full backup timeline vs Platform backups page

### P8 — Controller domains with clients but no page

Run `rg "platformFetch" web/src/api` vs `rg "from '../../api" web/src/pages/platform` to find orphans. Known clusters:

- Developer / Terraform schema (`/api/v1/developer/*`)
- HA status aggregate
- Fence events detail beyond Activity
- Full ops runbook execute flows (partial on Reports)
- Packetwolf / SIEM deep dives

### P9 — OpenStack ↔ Platform cross-links

- Platform host/VM rows → OpenStack instance when linked
- Platform networks → Neutron network detail
- Migration radar → OpenStack migrations tab

## How to measure progress

```bash
# Controller routes
rg -c '\.route\(' controller/src/api/mod.rs

# API exports never imported (rough)
comm -23 \
  <(rg -o "export (const|function|type) \w+" web/src/api --no-filename | sort -u) \
  <(rg -o "from ['\"].*api" web/src -N | sort -u)
```

Target for “good enough”: **every controller domain** has at least one of: Platform page, Integrations card, Classic page, or documented “API-only / agent”.

## Tier policy (user-facing)

1. **Normal** — simple desktop, dock, Integrations hub (default for first visit)
2. **Power** — operations sidebar subset
3. **Advanced** — full sidebar + firewall + developer routes

Users upgrade in **Settings → Appearance → Desktop density**.

## Related docs

- [machina-infrastructure-vision.md](./machina-infrastructure-vision.md) — Mission Control, geography, parity phases 0–5
- [machina-macos-os-manager-roadmap.md](./machina-macos-os-manager-roadmap.md) — shell UX roadmap
