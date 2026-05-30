# Zeus OS AI batches AI-432–451 — Vault/MFA inventory + air-gap bundles

> Horizon phase 28 (enterprise security slice). Secrets backend inventory, MFA policy stubs, sovereign export manifests.

## AI-432–436 — Schema

[`controller/migrations/029_enterprise_security.sql`](../controller/migrations/029_enterprise_security.sql):

- `vault_providers` — HashiCorp/file backend inventory
- `mfa_policies` — role-based WebAuthn/TOTP enrollment stubs
- `air_gap_bundles` — offline export manifest metadata

## AI-437–440 — Engine + APIs

[`controller/src/engine/enterprise_security.rs`](../controller/src/engine/enterprise_security.rs):

- `GET /api/v1/enterprise/security/overview`
- `GET/POST /api/v1/enterprise/vault/providers`
- `GET /api/v1/enterprise/mfa/policies`
- `POST /api/v1/enterprise/mfa/policies/{role}`
- `GET/POST /api/v1/enterprise/air-gap/bundles`
- `GET /api/v1/enterprise/air-gap/bundles/{id}`

## AI-441–443 — UI

[`PlatformSettingsHub.tsx`](../web/src/pages/platform/PlatformSettingsHub.tsx) — Security pane:

- Live admin MFA policy toggle (stub)
- Vault provider inventory
- Air-gap bundle manifest creator

Phase 27 polish: Control Center storage tier tile, backup SLA edit sheet on [`PlatformStorage.tsx`](../web/src/pages/platform/PlatformStorage.tsx).

## E2E

Section **ENTERPRISE SECURITY (AI-432–451)** in [`scripts/lib/e2e-platform-smoke.sh`](../scripts/lib/e2e-platform-smoke.sh).

## Out of scope

Live HashiCorp Vault integration, WebAuthn/SAML IdP, physical air-gap bundle packaging — inventory + simulation stubs only (v1 depth).
