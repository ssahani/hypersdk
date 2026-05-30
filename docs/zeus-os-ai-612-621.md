# Zeus OS AI batches AI-612–621 — Disk Utility (Phase 41)

> macOS **Disk Utility** — fleet storage pool capacity rings and hypervisor SMART health.

## Backend

[`controller/src/engine/fleet_storage.rs`](../controller/src/engine/fleet_storage.rs):

- `GET /api/v1/fleet/storage` — pool capacity/status rollup, tiers count, SMART failures from host linux-obs

## UI

- [`PlatformStorage.tsx`](../web/src/pages/platform/PlatformStorage.tsx) — renamed **Disk Utility**, **Disks** tab with fleet pool rings + SMART table

## Spotlight

`disk utility`, `smart fail`, `storage full` → `/platform/storage?tab=disks`

## CLI / E2E

- `platformctl fleet storage`
- `GET /api/v1/fleet/storage`
