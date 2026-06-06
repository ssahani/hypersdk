# Zeus OS AI batches AI-692–701 — Linux Base OS (Phase 59)

> Remote host patch preview/apply, reboot, and fleet Linux depth — parity with classic NodeInfo mutations via agent + controller tasks.

## Agent RPCs

[`agent/proto/agent.proto`](../agent/proto/agent.proto):

| RPC | Core | Purpose |
|-----|------|---------|
| `ApplyLinuxPackageUpgrade` | `package_upgrade_preview` / `package_upgrade` | `dry_run` preview vs apply |
| `HostLinuxReboot` | `host_reboot` | Hypervisor reboot |
| `GetLinuxFilesystems` | `list_host_filesystems` | `df` mounts |
| `GetLinuxTopProcesses` | `list_host_top_processes` | Top CPU/memory |

## Controller

- `POST /api/v1/hosts/{id}/linux/package-upgrade` — preview (`dry_run: true`) or enqueue `host.linux.package_upgrade`
- `POST /api/v1/hosts/{id}/linux/reboot` — enqueue `host.linux.reboot` (maintenance-gated)
- `GET /api/v1/hosts/{id}/linux/filesystems`, `GET .../linux/processes`
- Response normalizers for audit, network-diag, and updates (`packages[]`, `pending_count`, `reboot_required`)

## UI

- [`PlatformHostDetail.tsx`](../web/src/pages/platform/PlatformHostDetail.tsx) — Linux/Network/Audit depth, `?tab=` deep links, preview/apply/reboot CTAs
- [`PlatformMaintenance.tsx`](../web/src/pages/platform/PlatformMaintenance.tsx) — mission preview/apply + fleet bulk upgrade in maintenance
- [`PlatformZeusOs.tsx`](../web/src/pages/platform/PlatformZeusOs.tsx), [`PlatformActivityMonitor.tsx`](../web/src/pages/platform/PlatformActivityMonitor.tsx), [`PlatformHosts.tsx`](../web/src/pages/platform/PlatformHosts.tsx) — fleet Linux health surfaces
- Control Center + Dynamic Island — `hosts_reboot_required` from fleet updates

## Spotlight

`linux package upgrade`, `host reboot`, `host filesystems`, `maintenance mission apply` → host detail Linux tab or `/platform/maintenance?tab=mission`

## E2E

- [`platform-linux-os.spec.ts`](../web/e2e/platform-linux-os.spec.ts)
- [`platform-guest-security-fabric.spec.ts`](../web/e2e/platform-guest-security-fabric.spec.ts) — host audit events
- `scripts/lib/e2e-platform-smoke.sh` — HOST OS section: filesystems, processes, package-upgrade preview
