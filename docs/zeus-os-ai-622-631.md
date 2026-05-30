# Zeus OS AI batches AI-622–631 — Console.app (Phase 42)

> macOS **Console** — unified fleet log tail across audit, platform events, and tasks.

## Backend

[`controller/src/engine/fleet_console.rs`](../controller/src/engine/fleet_console.rs):

- `GET /api/v1/fleet/console` — merged chronological stream (audit + events + tasks), 24h counters

## UI

- [`PlatformEvents.tsx`](../web/src/pages/platform/PlatformEvents.tsx) — Console branding, source filters, monospace log stream

## Spotlight

`console`, `fleet log`, `audit log`, `task fail` → `/platform/events`

## CLI / E2E

- `platformctl fleet console`
- `GET /api/v1/fleet/console`
