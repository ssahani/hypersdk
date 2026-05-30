# Zeus OS AI batches AI-662–671 — Shortcuts Launchpad (Phase 46)

> macOS **Shortcuts** — blueprint Launchpad grid with one-click run.

## Backend

[`controller/src/engine/fleet_shortcuts.rs`](../controller/src/engine/fleet_shortcuts.rs):

- `GET /api/v1/fleet/shortcuts` — blueprint catalog, VM coverage, runbook execution counts

## UI

- [`PlatformBlueprints.tsx`](../web/src/pages/platform/PlatformBlueprints.tsx) — **Launchpad** tab (default) with `LaunchpadAppIcon` grid; **Studio** tab for NL/manual authoring
- [`PlatformMenuBar.tsx`](../web/src/components/platform/PlatformMenuBar.tsx) — Shortcuts quick link

## Spotlight

`shortcut`, `blueprint launchpad`, `run blueprint` → `/platform/blueprints?tab=launchpad`

## CLI / E2E

- `platformctl fleet shortcuts`
- `GET /api/v1/fleet/shortcuts`
