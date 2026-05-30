# Machina Fleet Desktop — menu bar + Mission Control (Phases 35–36)

> macOS-like fleet shell: unified status strip, Control Center, Mission Control, and Linux health rollup.

## Metaphor

| macOS | Machina |
|-------|---------|
| Menu bar | [`PlatformMenuBar.tsx`](../web/src/components/platform/PlatformMenuBar.tsx) in platform layout |
| Control Center | [`PlatformControlCenter.tsx`](../web/src/components/platform/PlatformControlCenter.tsx) |
| Mission Control | [`MissionControl.tsx`](../web/src/pages/MissionControl.tsx) |
| Dock | Quick links on [`PlatformDashboard.tsx`](../web/src/pages/platform/PlatformDashboard.tsx) |

## APIs

- `GET /api/v1/fleet/desktop` — Zeus, SLOs, tasks, notifications, linux pressure counts ([`fleet_desktop.rs`](../controller/src/engine/fleet_desktop.rs))
- `GET /api/v1/fleet/linux-health` — per-host PSI/thermal/SMART rollup ([`fleet_linux.rs`](../controller/src/engine/fleet_linux.rs))
- `POST /api/v1/ai/fleet/diagnose` — fleet-scoped NL diagnosis

## Frontend

- [`useFleetDesktop.ts`](../web/src/hooks/useFleetDesktop.ts) — shared poll for desktop + linux-health
- Menu bar linux-pressure pill links to hosts; Mission Control shows fleet summary strip

## CLI

```bash
platformctl desktop
platformctl fleet linux-health
```
