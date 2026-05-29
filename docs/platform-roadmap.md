# Machina Platform Roadmap (Batches 12–30+)

This document tracks the vCenter-class platform plan on libvirt/KVM. See also [`platform.md`](platform.md) for architecture.

## Batch status

| Batch | Theme | Status |
|-------|--------|--------|
| 12 | libvirt ops hardening — lifecycle phases, structured errors, host validation, live migrate after snap clone, reconcile | **Shipped** |
| 13 | Unified UX — proxy default, task drawer, global search, dashboard fusion, error banners | **Shipped** |
| 14 | Storage/network engine v1 — agent provision via virsh | **Shipped (v1)** |
| 15 | Enterprise ops — policy-lite, quotas, alerts via webhooks, support bundle, upgrade manager | **Shipped (v1)** |
| 16 | Ecosystem — `platformctl`, Terraform stub, chaos/soak scripts, cert matrix | **Shipped (v1)** |
| 17 | VM discover/adopt — unmanaged inventory from host sync, adopt API + UI | **Shipped (v1)** |
| 18 | Per-VM metrics — agent ListVms stats, `vm_metrics` table, Prometheus gauges, VM detail | **Shipped (v1)** |
| 19 | Content library v1 — ISO/image catalog API + UI | **Shipped (v1)** |
| 20 | Disk attach — agent `AttachDisk`, `vm.disk.attach` task, VM detail form | **Shipped (v1)** |
| 21 | Task/event SSE — `/api/v1/events/stream`, task drawer live refresh | **Shipped (v1)** |
| 22 | E2E + platformctl extensions for batches 17–21 | **Shipped (v1)** |
| 23 | macOS-like UX shell — dashboard, Finder VMs, tabs, Control Center, Settings hub, Migration/Activity/Recommendations shells | **Shipped (v1)** |
| 24 | Drag-and-drop migrate + network fix-it buttons | **Shipped (v1)** |
| 25 | Guest Tools agent RPC + health sync + UI strip | **Shipped (v1)** |
| 26 | Windows VM wizard + Migration Assistant HyperSDK scan | **Shipped (v1)** |
| 27 | Topology map + application groups API | **Shipped (v1)** |
| 28 | Health check engine + Fix It buttons | **Shipped (v1)** |
| 29 | Actionable notification center | **Shipped (v1)** |
| 30 | Template marketplace + ISO approval workflow | **Shipped (v1)** |
| 31 | Blueprints / automation shortcuts | **Shipped (v1)** |
| 32 | Workspaces (project-scoped views) | **Shipped (v1)** |
| 33 | FinOps capacity + cost dashboard | **Shipped (v1)** |
| 34 | Safe delete / approval workflows | **Shipped (v1)** |
| 35 | Task-centric rollback UX (cancel/retry) | **Shipped (v1)** |
| 36 | Natural language command bar (palette) | **Shipped (v1)** |
| 37 | Mobile-responsive platform nav | **Shipped (v1)** |
| 38 | Support Assistant + bundle export | **Shipped (v1)** |
| 39 | ISO checksum field on submit | **Shipped (v1)** |
| 40 | Full Migration Assistant + HyperSDK submit | **Shipped (v1)** |
| 41 | Mac UI wave 1 — VMs, Hosts, Tasks, Alerts + shared empty/filter components | **Shipped (v1)** |
| 42 | Storage pool discover + Welcome wizard + Storage Mac UI | **Shipped (v1)** |
| 43 | Template readiness API + deploy traffic-light UX | **Shipped (v1)** |
| 44 | Spotlight ops — platform command router + review/confirm in ⌘K | **Shipped (v1)** |
| 45 | Mac UI wave 2 — Content, Backups, Migration, Activity, Reports | **Shipped (v1)** |
| 46 | Mac UI wave 3 (admin pages) + Control Center 2.0 | **Shipped (v1)** |
| 47 | Help dialog Platform tab + docs sync | **Shipped (v1)** |
| 48 | Host stale detection, E2E extensions, remote deploy verify | **Shipped (v1)** |

## Batch 41–48 deliverables (Awesome Sweep)

- **41:** `PlatformEmptyState`, `PlatformFilterPills`; Mac polish on VMs, Hosts, Tasks, Alerts
- **42:** Agent `ListStoragePools`, `storage_sync`, `POST /api/v1/storage/pools/discover`, `PlatformStorage` cards, `PlatformWelcome`
- **43:** `GET /api/v1/templates/{name}/{version}/readiness`, deploy sheet readiness banner
- **44:** `web/src/utils/platformCommands.ts`, CommandPalette review → confirm flow
- **45–46:** Mac UI on remaining platform pages; Control Center memory/offline/alerts sparkline row
- **47:** Help → Platform tab; `platform-ux-vision.md` / `platform-roadmap.md` updated
- **48:** Host `last_heartbeat_at` > 2m → `offline` in API; E2E storage discover + template readiness


Batches are grouped into **phases** (~10 batches each). Phases 1–2 (batches 1–16) established core platform + enterprise v1. Phases 3–10 below extend toward full vCenter parity.

| Phase | Batches | Focus |
|-------|---------|--------|
| 3 | 17–26 | Inventory depth — discover, metrics, content, disks, import/export |
| 4 | 27–36 | Multi-site — federation, DR replicas, stretch clusters |
| 5 | 37–46 | Networking — NSX-class overlays, micro-segmentation, IPAM |
| 6 | 47–56 | Storage — vSAN-class tiers, snapshots at scale, backup SLAs |
| 7 | 57–66 | Operations — runbooks automation, compliance, cost showback |
| 8 | 67–76 | Developer ecosystem — Terraform provider GA, SDK, marketplace |
| 9 | 77–86 | Observability — tracing, SLO dashboards, predictive placement |
| 10 | 87–100 | Enterprise hardening — Vault/MFA, air-gap, cert FIPS, multi-tenant isolation |

## Batch 17 deliverables

- Migration `012_platform_batch17.sql`: `vm_metrics`, `content_images`, `network_reservations`
- Host inventory inserts **unmanaged** VMs when libvirt domain not in DB; emits `vm.discovered`
- `POST /api/v1/vms/{id}/adopt`, `GET /api/v1/vms?managed=false`
- Web: discovered-only toggle + Adopt on VMs list and detail

## Batch 18 deliverables

- Agent `ListVms` returns per-VM memory and disk IOPS from libvirt metrics
- Controller upserts `vm_metrics` on `host.inventory`
- `GET /api/v1/vms/{id}/metrics`, Prometheus `machina_vm_*` gauges
- VM detail metrics strip

## Batch 19 deliverables

- `GET/POST /api/v1/content/images`
- Web `/platform/content` content library page

## Batch 20 deliverables

- Agent `AttachDisk` gRPC + virsh attach-disk
- `POST /api/v1/vms/{id}/disks/attach` → `vm.disk.attach` task
- VM detail attach-disk form

## Batch 21 deliverables

- `GET /api/v1/events/stream` SSE on controller event bus
- Platform task drawer subscribes via EventSource + polling fallback

## Batch 22 deliverables

- E2E smoke: content images, VM metrics, managed filter, SSE probe
- `platformctl` commands: `content`, `vm metrics`, `vm adopt`, `events-stream`

## Batch 29 deliverables

- Actionable notification center with Retry backup, Open VM, View tasks

## Batch 30 deliverables

- Migration `014_platform_batch30.sql`: content approval fields, template marketplace metadata
- ISO workflow: new images start `pending`; `POST /api/v1/content/images/{id}/approve|reject`
- Template marketplace: `GET /api/v1/templates/marketplace`, featured/category metadata on templates
- Web: approval queue on `/platform/content`, App Store-style `/platform/templates` marketplace
- E2E smoke: marketplace GET, ISO submit → approve; `platformctl marketplace`, `content-approve`

## Explicit deferrals

See [`enterprise-backlog.md`](enterprise-backlog.md): Vault/MFA, multi-site DR, plugin marketplace, in-browser RDP.

## Machina AI batches (AI-49+)

See [`machina-ai-vision.md`](machina-ai-vision.md) for the full vision.

| Batch | Deliverable |
|-------|-------------|
| AI-49 | AI foundation: settings, context assembler, Copilot shell, Spotlight ⌘Space |
| AI-50 | Machina Doctor 0–100 + unified VM detail tab |
| AI-51 | Migration Radar + HyperSDK integration |
| AI-52 | Cost Guardian + Capacity Planner |
| AI-53 | Security Sentinel + Network Lens |
| AI-54 | Runbook generator + notification actions |
| AI-55 | Blueprint Studio + Explain button rollout |
| AI-56 | Mission Control + Dock + Control Center AI mode |
| AI-57 | Network Lens UI + Copilot network queries |
| AI-58 | Time Machine backup timeline |
| AI-59 | AI Terminal Companion |
| AI-60 | Policy Generator YAML export |
| AI-61 | Navbar Copilot + VM context + polish |
| AI-62 | Autopilot preview propose/execute |
| AI-63 | Compliance report + export |
| AI-64 | Time Machine restore UX |
| AI-65 | Terminal Companion v2 |
| AI-66 | AI settings sync + E2E |
| AI-67 | Autopilot run (guarded batch) |
| AI-68 | Compliance HTML/PDF export |
| AI-69 | Terminal command suggestions |
| AI-70 | Autopilot dashboard |
| AI-71 | v4 E2E + docs |
| AI-72 | Copilot SSE streaming |
| AI-73 | Compliance PDF export |
| AI-74 | Scheduled Autopilot cron |
| AI-75 | v5 UI polish |
| AI-76 | v5 E2E + docs |
