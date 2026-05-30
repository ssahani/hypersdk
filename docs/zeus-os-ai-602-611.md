# Zeus OS AI batches AI-602–611 — Network System Settings + Lens (Phase 40)

> macOS **Network** System Settings pane + dedicated **Network Lens** tab.

## Backend

[`controller/src/engine/fleet_network.rs`](../controller/src/engine/fleet_network.rs):

- `GET /api/v1/fleet/network` — networks, segments, IPAM pools, micro-seg grades

## UI

- [`PlatformSettingsHub.tsx`](../web/src/pages/platform/PlatformSettingsHub.tsx) — **Network** pane: fleet summary, overlay segments, Lens link, host systemd link (`?section=network`)
- [`PlatformNetworks.tsx`](../web/src/pages/platform/PlatformNetworks.tsx) — **Network Lens** tab with [`MachinaNetworkLens`](../web/src/components/ai/MachinaNetworkLens.tsx)

## Spotlight

`network lens`, `can't reach vm`, `reach vm` → `/platform/networks?tab=lens`

## CLI / E2E

- `platformctl fleet network`
- `GET /api/v1/fleet/network`
