# Machina deploy plan — macOS OS Manager Phases 38–47

> Snapshot saved before remote deploy. Update this file at each ship boundary.

## Deploy target

| Field | Value |
|-------|--------|
| Host | `212.8.252.194` |
| User | `sus` |
| UI | https://212.8.252.194:5092/ |
| Platform API | http://212.8.252.194:5093/api/v1/health |
| Remote tree | `~/.deployment/machina` |

## Git snapshot

| Commit | Message |
|--------|---------|
| `c5706fd` | Save deploy plan snapshot for Phases 38–47 |

Branch: `main` (synced with `origin/main`)

## Shipped in this deploy (Phases 38–47)

| Phase | AI | macOS app | Fleet API |
|-------|-----|-----------|-----------|
| 38 | 582–591 | Time Machine | `GET /api/v1/fleet/backups` |
| 39 | 592–601 | Finder | `GET /api/v1/fleet/finder` |
| 40 | 602–611 | Network | `GET /api/v1/fleet/network` |
| 41 | 612–621 | Disk Utility | `GET /api/v1/fleet/storage` |
| 42 | 622–631 | Console | `GET /api/v1/fleet/console` |
| 43 | 632–641 | Software Update | `GET /api/v1/fleet/updates` |
| 44 | 642–651 | Keychain | `GET /api/v1/fleet/keychain` |
| 45 | 652–661 | Users & Groups | `GET /api/v1/fleet/users` |
| 46 | 662–671 | Shortcuts | `GET /api/v1/fleet/shortcuts` |
| 47 | 672–681 | Stage Manager | `GET /api/v1/fleet/spaces` |

Each phase includes: Mac UI pane, Spotlight intent, `platformctl fleet *`, E2E smoke, and `docs/zeus-os-ai-*.md`.

## Deploy command

```bash
cd /Users/ssahani/tt/machina
VSPASS=max ./scripts/deploy-remote.sh sus 212.8.252.194 --quick --platform --e2e --bind 0.0.0.0 --open-firewall
```

Quick-only (no platform/E2E):

```bash
VSPASS=max ./scripts/deploy remote --quick
```

## Post-deploy verification

```bash
curl -sk https://212.8.252.194:5092/api/v1/health
curl -s http://212.8.252.194:5093/api/v1/health
./scripts/platformctl fleet spaces    # Phase 47
./scripts/platformctl fleet shortcuts # Phase 46
```

Spotlight smoke (platform UI): `stage manager`, `shortcut launchpad`, `users and groups`.

## Next up (Phase 48+)

Horizon starts at **Phase 48** (AI 682–2581). See [`machina-macos-os-manager-roadmap.md`](machina-macos-os-manager-roadmap.md) layer map for the next macOS layer tranche.

## Related docs

- [`platform-roadmap.md`](platform-roadmap.md)
- [`machina-macos-os-manager-roadmap.md`](machina-macos-os-manager-roadmap.md)
- Phase stubs: `docs/zeus-os-ai-582-591.md` … `docs/zeus-os-ai-672-681.md`
