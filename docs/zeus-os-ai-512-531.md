# Zeus OS AI batches AI-512–531 — Enterprise hardening (Phase 32)

> Horizon phase 32. Live Vault sync probes, MFA compliance, FIPS crypto matrix, and workspace tenant isolation.

## AI-512–516 — Schema

[`controller/migrations/033_enterprise_hardening.sql`](../controller/migrations/033_enterprise_hardening.sql):

- `vault_sync_runs` — provider health probe audit
- `mfa_enrollments` — enrollment inventory vs required policies
- `fips_crypto_profiles` — TLS/FIPS target profiles
- `tenant_isolation_policies` — per-project quota and network isolation stubs

## AI-517–521 — Engine + scheduler

[`controller/src/engine/enterprise_security.rs`](../controller/src/engine/enterprise_security.rs):

- `POST /api/v1/enterprise/vault/providers/{id}/sync`
- `POST /api/v1/enterprise/vault/sync-all`
- `GET /api/v1/enterprise/mfa/compliance`
- `GET /api/v1/enterprise/fips/matrix`
- `GET /api/v1/enterprise/tenants/overview`
- `POST /api/v1/enterprise/tenants/policies/{project}`

[`controller/src/engine/vault_sync_scheduler.rs`](../controller/src/engine/vault_sync_scheduler.rs) — 30-minute Vault sync tick.

## AI-522–525 — UI

[`PlatformEnterprise.tsx`](../web/src/pages/platform/PlatformEnterprise.tsx) — Vault | MFA | FIPS | Tenants tabs at `/platform/enterprise`.

## E2E

Section **ENTERPRISE HARDENING (AI-512–531)** in [`scripts/lib/e2e-platform-smoke.sh`](../scripts/lib/e2e-platform-smoke.sh).

## Out of scope

Live HashiCorp Vault AppRole auth, WebAuthn IdP enrollment, FIPS-validated OpenSSL module selection, enforced multi-tenant network ACLs.
