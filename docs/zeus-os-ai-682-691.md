# Zeus OS AI batches AI-682–691 — General (Phase 48)

> macOS **System Settings → General** — fleet desktop appearance, dock defaults, and cluster summary.

## Backend

[`controller/src/engine/fleet_general.rs`](../controller/src/engine/fleet_general.rs):

- `GET /api/v1/fleet/general` — cluster name, host/VM counts, wallpaper catalog, default dock pins

## UI

- [`PlatformAppearanceSettings.tsx`](../web/src/components/platform/PlatformAppearanceSettings.tsx) — wallpaper picker + Customize Dock + fleet general summary
- [`PlatformDockEditor.tsx`](../web/src/components/platform/mac/PlatformDockEditor.tsx) — dock pin editor (v9s parity)
- [`PlatformMacAppMenus.tsx`](../web/src/components/platform/mac/PlatformMacAppMenus.tsx) — Help menu + Customize Dock

## Spotlight

`general settings`, `appearance wallpaper`, `customize dock` → `/platform/settings?section=general`

## CLI / E2E

- `platformctl fleet general`
- `GET /api/v1/fleet/general`
