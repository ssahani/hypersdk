# Zeus OS AI batches AI-592–601 — Finder smart folders (Phase 39)

> macOS **Finder** metaphor — smart folders, tag sidebar, project groups on VM browse.

## Backend

[`controller/src/engine/fleet_finder.rs`](../controller/src/engine/fleet_finder.rs):

- `GET /api/v1/fleet/finder` — smart folder counts, tag index, project rollups

[`controller/src/api/vms.rs`](../controller/src/api/vms.rs) list query:

- `folder` — `all`, `running`, `stopped`, `discovered`, `untagged`, `high_cpu`, `unprotected`, `ha_enabled`
- `tag` — filter VMs containing tag

## UI

[`PlatformVms.tsx`](../web/src/pages/platform/PlatformVms.tsx):

- Renamed **Finder** with left sidebar (Smart Folders · Tags · Projects)
- URL params `?folder=` · `?tag=` · `?project=`
- Tags column in list view; tag chips on Launchpad icons

## Spotlight

`finder`, `smart folder`, `tag vm`, `high cpu vm` intents in [`intent_router.rs`](../controller/src/engine/ai/intent_router.rs).

## CLI / E2E

- `platformctl fleet finder`
- `GET /api/v1/fleet/finder` + `GET /api/v1/vms?folder=running`
