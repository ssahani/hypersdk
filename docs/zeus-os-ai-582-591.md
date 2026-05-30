# Zeus OS AI batches AI-582–591 — Time Machine fleet (Phase 38)

> macOS **Time Machine** metaphor — fleet backup rollup, timeline grouping, restore strip.

## Backend

[`controller/src/engine/fleet_backups.rs`](../controller/src/engine/fleet_backups.rs):

- `GET /api/v1/fleet/backups` — counts (24h completed/failed, snapshots, VMs protected 7d) + recent events

## UI

[`PlatformBackups.tsx`](../web/src/pages/platform/PlatformBackups.tsx):

- Renamed section **Time Machine**
- Day-grouped timeline (Today / Yesterday / …)
- Fleet stat widgets from `/fleet/backups`
- Menu bar + dock links

## Spotlight

`time machine` / `backup` → `/platform/backups` in [`intent_router.rs`](../controller/src/engine/ai/intent_router.rs).

## CLI / E2E

- `platformctl fleet backups`
- `GET /api/v1/fleet/backups` in fleet desktop E2E block

See [`machina-macos-os-manager-roadmap.md`](machina-macos-os-manager-roadmap.md) for phases 39–237.
