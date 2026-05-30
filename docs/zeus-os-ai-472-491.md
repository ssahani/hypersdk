# Zeus OS AI batches AI-472–491 — Developer ecosystem (Phase 30)

> Horizon phase 30. TypeScript SDK GA, Terraform schema export, and developer overview API.

## AI-472–476 — SDK

[`sdk/typescript/`](../sdk/typescript/):

- `@zyvor/machina-sdk` v0.1.0 — `MachinaClient` with health, hosts, VMs, operations, observability helpers
- Build: `cd sdk/typescript && npm install && npm run build`

## AI-477–481 — Terraform GA schemas

[`terraform/machina/examples/`](../terraform/machina/examples/) — HTTP provider example against controller REST.

- `GET /api/v1/developer/terraform/schema` — resource attribute inventory
- `GET /api/v1/developer/overview` — SDK install paths + OpenAPI link

## AI-482–485 — APIs

[`controller/src/engine/developer.rs`](../controller/src/engine/developer.rs):

- `GET /api/v1/developer/overview`
- `GET /api/v1/developer/terraform/schema`

## AI-486–488 — UI

[`PlatformDeveloper.tsx`](../web/src/pages/platform/PlatformDeveloper.tsx) — SDK install, Terraform resource table, OpenAPI link.

## E2E

Section **DEVELOPER ECOSYSTEM (AI-472–491)** in [`scripts/lib/e2e-platform-smoke.sh`](../scripts/lib/e2e-platform-smoke.sh).

## Out of scope

Published Terraform Registry provider binary, SDK npm publish, marketplace plugin SDK.
