# Zeus OS AI batches AI-652–661 — Users & Groups (Phase 45)

> macOS **Users & Groups** — fleet RBAC rollup + menu bar workspace switcher.

## Backend

[`controller/src/engine/fleet_users.rs`](../controller/src/engine/fleet_users.rs):

- `GET /api/v1/fleet/users` — platform users by role + workspace/tenant groups with isolation status

## UI

- [`PlatformUsers.tsx`](../web/src/pages/platform/PlatformUsers.tsx) — **Users** + **Groups** tabs, workspace switcher integration
- [`PlatformMenuBar.tsx`](../web/src/components/platform/PlatformMenuBar.tsx) — workspace dropdown (persists in `localStorage`)
- [`useActiveWorkspace.ts`](../web/src/hooks/useActiveWorkspace.ts) — shared active workspace state

## Spotlight

`users and groups`, `workspace switch`, `switch tenant` → `/platform/users?tab=workspaces`

## CLI / E2E

- `platformctl fleet users`
- `GET /api/v1/fleet/users`
