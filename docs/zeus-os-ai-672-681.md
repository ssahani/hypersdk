# Zeus OS AI batches AI-672–681 — Stage Manager (Phase 47)

> macOS **Stage Manager** — horizontal workspace spaces strip with VM focus.

## Backend

[`controller/src/engine/fleet_spaces.rs`](../controller/src/engine/fleet_spaces.rs):

- `GET /api/v1/fleet/spaces` — per-project VM/running/host counts merged with tenant isolation policies

## UI

- [`PlatformProjects.tsx`](../web/src/pages/platform/PlatformProjects.tsx) — Stage Manager spaces strip + detail table; click-to-focus active workspace
- [`PlatformMenuBar.tsx`](../web/src/components/platform/PlatformMenuBar.tsx) — Spaces quick link

## Spotlight

`stage manager`, `workspace spaces`, `stage workspace` → `/platform/projects`

## CLI / E2E

- `platformctl fleet spaces`
- `GET /api/v1/fleet/spaces`
