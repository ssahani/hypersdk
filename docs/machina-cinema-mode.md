# Machina Cinema Mode

Machina ConsoleHub ships three operator experiences for VM access:

| Mode | URL | Best for |
|------|-----|----------|
| **Machina Cinema** | `/platform/vms/:id/consolehub?mode=cinema` | VNC, SPICE, WebRTC display — full-screen, player-style HUD |
| **Machina Studio** | `/platform/vms/:id/consolehub?mode=studio` | Serial, Shell, split panes, recovery cards, lens bar |
| **Mission Control wall** | `/platform/mission-control/live` | Fleet live preview grid (max 6 concurrent thumbnails) |

Public UI copy uses **Machina Cinema**, **Machina Studio**, and **Ops Shelf** — not “Netflix mode” or generic “ConsoleHub tabs.”

## Cinema (default display experience)

- **Hero layout:** VM canvas fills the viewport; platform sidebar and checklist are hidden.
- **Access Note pill:** Guest/NAT/SSH warnings collapse into one expandable pill (`AccessNotePill`).
- **Control strip:** Bottom HUD with power, scale (Fit/Fill/Native/Scroll/Stretch), screenshot, Studio toggle, Ops Shelf handle. Auto-hides after ~3.5s idle; move mouse to reveal.
- **Command palette:** ⌘K scoped console actions (`ConsoleCommandPalette`).
- **Entry points:** VM detail “Open Cinema”, Machine Finder gallery tiles, Fleet Command Center, Spotlight, Live Preview Wall.

Helper paths live in [`web/src/utils/consoleExperienceMode.ts`](../web/src/utils/consoleExperienceMode.ts):

- `cinemaHubPath(vmId)` — explicit Cinema deep link
- `studioHubPath(vmId)` — engineer layout
- `cinemaPopoutPath(vmId)` — centered popout window

## Studio (engineer layout)

- Lens bar: Display · Serial · Shell · AI
- Full banners and recovery cards (`ConsoleLoginRecoveryCard`, `GuestAccessBanner`, `ShellAccessBanner`)
- Ops Shelf slide-over (refactored `CommandCenterPanel`) with port forwards, health, timeline
- Serial-recommended VMs auto-redirect from Cinema → Studio

## Mode persistence

Operators who prefer Studio get their choice restored per VM:

- Key: `localStorage['machina-console-mode:{vmId}']`
- Applied when opening `/platform/vms/:id/consolehub` **without** a `mode` query param
- Explicit `?mode=cinema` links (Open Cinema CTAs) always honor Cinema

## Fleet surfaces

- **Gallery lens** — Machine Finder → Gallery → Netflix-style rows with poster screenshots
- **Live Preview Wall** — Mission Control launchpad → `/platform/mission-control/live`

## Graphics (VNC + SPICE)

New VMs default to `graphics.type: both`. Existing VMs can add/remove listeners via VM Settings → Graphics panel or API:

- `POST /api/v1/vms/{id}/graphics/add`
- `POST /api/v1/vms/{id}/graphics/remove`

## Tests

| Suite | Coverage |
|-------|----------|
| `web/e2e/platform-consolehub.spec.ts` | Cinema default, pill, strip idle-hide, Studio, Ops Shelf, mode restore |
| `web/e2e/platform-machine-finder.spec.ts` | Gallery lens → Open Cinema |
| `web/e2e/platform-mission-control-live.spec.ts` | Live wall tiles |
| `web/src/utils/consoleExperienceMode.test.ts` | Path helpers + persistence |
| `web/src/utils/guestAccessHints.test.ts` | Access Note pill aggregation |

Run locally:

```bash
cd web && npm run build && npx playwright test e2e/platform-consolehub.spec.ts
cd web && npm test -- consoleExperienceMode
```

## Deferred (enterprise phase)

Session recording, RBAC-gated console actions, watermark/read-only support sessions, SPICE audio, multi-monitor, collaborative shared console.
