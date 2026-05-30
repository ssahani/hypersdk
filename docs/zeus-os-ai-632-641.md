# Zeus OS AI batches AI-632–641 — Software Update (Phase 43)

> macOS **Software Update** — fleet host patch catalog from distro package managers.

## Backend

- Agent RPC `GetLinuxPackageUpdates` → [`host_platform::check_package_updates`](../core/src/host_platform.rs)
- `GET /api/v1/fleet/updates` — [`fleet_updates.rs`](../controller/src/engine/fleet_updates.rs)
- `GET /api/v1/hosts/{id}/linux/updates` — per-host probe

## UI

- [`PlatformMaintenance.tsx`](../web/src/pages/platform/PlatformMaintenance.tsx) — **Updates** tab (default) + **Schedules** tab

## Spotlight

`software update`, `host patch`, `pending update`, `package update` → `/platform/maintenance?tab=updates`

## CLI / E2E

- `platformctl fleet updates`
- `GET /api/v1/fleet/updates`
