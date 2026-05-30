# Zeus OS AI batches AI-642–651 — Keychain Access (Phase 44)

> macOS **Keychain Access** — fleet secrets inventory (metadata only, link-out).

## Backend

[`controller/src/engine/fleet_keychain.rs`](../controller/src/engine/fleet_keychain.rs):

- `GET /api/v1/fleet/keychain` — vault providers, MFA policies, API keys, air-gap bundles (no secret values)

## UI

- [`PlatformEnterprise.tsx`](../web/src/pages/platform/PlatformEnterprise.tsx) — **Keychain** tab (default) with unified inventory + link-outs
- [`PlatformSettingsHub.tsx`](../web/src/pages/platform/PlatformSettingsHub.tsx) — Security pane Keychain link

## Spotlight

`keychain`, `secrets inventory`, `api keys`, `vault list` → `/platform/enterprise?tab=keychain`

## CLI / E2E

- `platformctl fleet keychain`
- `GET /api/v1/fleet/keychain`
