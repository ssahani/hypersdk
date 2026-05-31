# Zyvor Platform UX Vision

> **The power of KVM. The control of vCenter. The simplicity of macOS.**

libvirt/KVM remains the engine. The platform is the **human operating layer** — users manage virtual datacenters, not XML, bridges, or QEMU flags.

## Design principles

1. **Simple outside, powerful inside** — default flows hide complexity; Pro View exposes NUMA, firmware, TPM, placement policy.
2. **Translate infrastructure into operations** — errors include remediation and one-click fix paths, not raw libvirt messages.
3. **Finder + Spotlight + System Settings** — browse VMs visually, search everything with ⌘K, configure in a calm settings hub.
4. **Tasks are visible** — every operation is a task with steps, progress, and rollback where safe.
5. **Confidence before risk** — safe-mode previews for delete, migrate, and restore.

## Navigation (shipped v1)

```text
Dashboard · VMs · Applications · Hosts
Storage · Networks · Images & ISOs · Templates
Migration Assistant · Backup · Tasks · Alerts
Activity Monitor · Recommendations · Settings
```

Implemented in [`web/src/layouts/PlatformLayout.tsx`](../web/src/layouts/PlatformLayout.tsx) and [`web/src/utils/platformNav.ts`](../web/src/utils/platformNav.ts).

## Shipped UX (batch 23)

| Feature | Location |
|---------|----------|
| Virtual Datacenter dashboard | `/platform` |
| Finder-style VM grid + list | `/platform/vms` |
| Simple Create VM wizard | VM list + dashboard |
| VM detail tabs (Overview, Console, Performance, …) | `/platform/vms/:id` |
| Migration Assistant shell | `/platform/migration` |
| ISO library categories + lifecycle badges | `/platform/content` |
| macOS Settings hub | `/platform/settings` |
| Control Center panel | Platform layout header |
| Spotlight platform actions | ⌘K command palette |
| Activity Monitor | `/platform/activity` |
| Recommendations | `/platform/recommendations` |
| Application groups (preview) | `/platform/applications` |
| Time Machine-style backup hub | `/platform/backups` |

## Roadmap — UX batches 24–40 (shipped)

| Batch | Theme | Status |
|-------|--------|--------|
| 24 | Drag-and-drop migrate VM → host with pre-check modal | Shipped |
| 25 | Guest Tools agent + “Installed and healthy” UI | Shipped |
| 26 | Windows VM wizard (VirtIO, TPM, unattend.xml) | Shipped |
| 27 | Topology map + anti-affinity warnings | Shipped |
| 28 | Health check + Fix It buttons on VM/host/cluster | Shipped |
| 29 | Notification center with actionable alerts | Shipped |
| 30 | Template App Store catalog + versioning | Shipped |
| 31 | Blueprints / automation shortcuts | Shipped |
| 32 | Workspaces (multi-tenant spaces) | Shipped |
| 33 | FinOps capacity + cost dashboard | Shipped |
| 34 | Safe delete / approval workflows | Shipped |
| 35 | Undo / rollback UX for network & migrate | Shipped |
| 36 | Natural language command bar (plan → review → execute) | Shipped |
| 37 | Mobile-responsive admin views | Shipped |
| 38 | Support Assistant troubleshooting | Shipped |
| 39 | ISO upload, checksum, approval workflow (backend) | Shipped |
| 40 | Full Migration Assistant + HyperSDK pipeline | Shipped |

## Awesome Sweep — UX batches 41–48 (shipped)

| Batch | Theme |
|-------|--------|
| 41 | Mac UI wave 1 — daily pages + `PlatformEmptyState` / `PlatformFilterPills` |
| 42 | Storage discover from libvirt + first-run Welcome wizard |
| 43 | Template deploy readiness (traffic-light + remediation) |
| 44 | ⌘K platform commands (`import storage`, `sync hosts`, …) with confirm step |
| 45 | Mac UI wave 2 — Content, Backups, Migration, Activity, Reports |
| 46 | Mac UI wave 3 — admin pages + Control Center 2.0 |
| 47 | Help → Platform tab + roadmap docs sync |
| 48 | Stale host detection + extended platform E2E smoke |

## Awesome Sweep — UX batches 49–56 (shipped)

| Batch | Theme |
|-------|--------|
| 49 | Mac UI wave 4 — VM/Host detail, Settings, Blueprints, Topology → `MacGlassPanel` |
| 50 | Control Center 3.0 — module grid (Cluster / Firewall / Copilot / Tasks) |
| 51 | Control Center quick actions — sync hosts, Zeus OS, firewall overview |
| 52 | System Settings sidebar — General · Security · Network · … via `MacSettingsPane` |
| 53 | Settings Security + Network panes — Zeus Firewall summary, approval SLA |
| 54 | VM Security tab — in-guest ports via QEMU agent |
| 55 | MacToggle / sheets keyboard + touch baseline on firewall flows |
| 56 | E2E smoke + docs for macOS-like firewall + wave 4 |

## Tagline options

- *Zyvor makes KVM feel as polished as macOS and as operationally powerful as vCenter.*
- *Manage your entire virtual datacenter like a modern operating system — not like a pile of scripts.*

See also [`machina-macos-os-manager-roadmap.md`](machina-macos-os-manager-roadmap.md) for Phases 38–237 (macOS OS Manager horizon).

## UX polish waves (2026-05)

| Wave | Theme | Status |
|------|--------|--------|
| W1 | Global `platform-readable`, ShellBridgeBar, empty/loading sweep, Welcome + tier hints | Shipped |
| W2 | JsonInspector human views, block job / migration job cards, error remediation hints | Shipped |
| W3 | Cross-shell consistency — colors v2, Help/bridge parity, e2e matrix | Planned — [`next-big-sweep.md`](next-big-sweep.md) |
