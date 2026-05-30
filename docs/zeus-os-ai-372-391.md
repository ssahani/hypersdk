# Zeus OS AI batches AI-372–391 — macOS-like Firewall UX

> Shipped with Platform UX batches 49–56. Zeus Firewall as **System Settings → Network → Firewall**.

## AI-372–374 — Shared Mac security components

| Component | macOS analog | File |
|-----------|--------------|------|
| `MacToggle` | Settings switch | `web/src/components/platform/mac/PlatformMacUi.tsx` |
| `MacSettingsPane` | Settings sidebar + detail | same |
| `MacListRow` | Security list rows | same |
| `MacSegmentedControl` | Stealth / profile picker | same |
| `MacSettingsGroup` | Grouped settings sections | same |

CSS: `.platform-mac-toggle` focus ring in `web/src/styles/main.css`.

## AI-375–378 — Target detail (Security & Privacy pane)

`web/src/pages/platform/security/PlatformFirewallTargetDetail.tsx`:

- Master **Firewall** toggle via `planFirewall` / `applyFirewall` with `enable: true|false`
- **Stealth mode** segmented control → `stealth_level` on apply API
- **Profile** picker with dry-run diff preview in `MacSheet`
- **Incoming connections** as `MacListRow` allow-list (merged from services)
- **Advanced** tab — lockdown, AI explain, checkpoints

Backend: `core/src/firewall/apply.rs` — when `enable: false`, emit ufw disable / firewalld panic / iptables ACCEPT default.

## AI-379–381 — Fleet + activity views

| Page | UX |
|------|-----|
| `PlatformFirewallOverview.tsx` | Launchpad machine grid + icon quick links |
| `PlatformFirewallActivity.tsx` | Notification Center-style blocked/allowed groups |
| `PlatformFirewallPorts.tsx` | `MacListRow` + filter pills |

## AI-382–384 — Replace JSON admin pages

| Page | UX |
|------|-----|
| `PlatformFirewallK8s.tsx` | Status card + manifest preview in sheet |
| `PlatformFirewallCloud.tsx` | Provider stat widgets + SG list rows |
| `PlatformFirewallConnectivity.tsx` | Allow/block two-column matrix |

## AI-385–387 — VM + Settings + Control Center

- **VM detail** — Security tab: `GET /api/v1/zeus-firewall/vms/{id}/guest-ports`
- **Settings hub** — Security + Network panes: fleet summary, `firewall_approval_sla_hours`
- **Control Center** — Zeus row from `GET /api/v1/ai/zeus/summary` (`firewall_critical_hosts`, `firewall_drift_hosts`)

## AI-388–391 — Spotlight + E2E + docs

Spotlight intents in `controller/src/engine/ai/intent_router.rs`:

- `firewall settings` → `/platform/settings`
- `block incoming` → firewall overview
- `open ports` → `/platform/zeus/security/ports`

E2E: `scripts/lib/e2e-platform-smoke.sh` — cluster settings, zeus summary, plan dry-run, guest-ports (soft), intent queries.

## Cluster settings

Migration `023_firewall_phases16_25.sql`: `clusters.firewall_approval_sla_hours` (default 72).

API: `GET/PATCH /api/v1/cluster/settings` includes `firewall_approval_sla_hours`.

## Success criteria (verified at ship)

- [x] Firewall on/off and profile/stealth from target detail with preview + apply
- [x] No primary firewall workflow shows raw JSON on screen
- [x] VM detail exposes in-guest ports when agent reachable
- [x] Control Center and Settings surface firewall posture
- [x] Top daily pages use Mac glass components
- [x] E2E smoke covers new paths

See also [`platform-ux-vision.md`](platform-ux-vision.md) UX batches 49–56.
