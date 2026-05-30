# Zeus OS AI batches AI-392–411 — NSX-class overlays + micro-segmentation

> Phase 26. Overlay segment inventory, IPAM stub, micro-segmentation compiler, LLDP topology, GitOps export.

## AI-392 — Schema

[`controller/migrations/026_network_overlays.sql`](../controller/migrations/026_network_overlays.sql):

- `network_segments`, `network_ipam_pools`
- `segment_id` on `networks`; `pool_id` / `hostname` on `network_reservations`
- Seed `prod-tier1`, `dmz-tier0`

## AI-393 — Core overlay model

[`core/src/network/overlay.rs`](../core/src/network/overlay.rs): tier0/tier1, CIDR helpers, east-west defaults, micro-seg grade, rule compiler stub.

## AI-394–396 — Controller engine

[`controller/src/engine/network_overlay.rs`](../controller/src/engine/network_overlay.rs):

- IPAM allocate / next-free from pool CIDR
- Segment ↔ network bind
- Micro-segment policy compiler → Zeus connectivity simulation
- Emergency unlock stub (east-west → allow)

## AI-397–400 — APIs

- `GET /api/v1/hosts/{id}/lldp` — controller → agent REST proxy
- `GET /api/v1/network/segments/overview`
- `POST /api/v1/network/segments/{id}/connectivity`
- `POST /api/v1/network/segments/{id}/ipam/allocate`
- `GET /api/v1/network/segments/gitops/export`
- Topology merges segment + LLDP nodes ([`topology.rs`](../controller/src/api/topology.rs))

## AI-403–404 — UI

- [`PlatformNetworks.tsx`](../web/src/pages/platform/PlatformNetworks.tsx) — Segments + IPAM tabs
- [`PlatformTopology.tsx`](../web/src/pages/platform/PlatformTopology.tsx) — LLDP uplink strip + segment legend

## AI-406–408 — Integrations

- Digital twin `target_kind=segment` + `action=isolate`
- Spotlight: `micro-segment`, `overlay network`, `IPAM`

## E2E (AI-409)

Section **ZEUS/PLATFORM PHASE 26** in [`scripts/lib/e2e-platform-smoke.sh`](../scripts/lib/e2e-platform-smoke.sh).

## Out of scope

Live NSX-T / OVN dataplane, Vault/MFA, air-gap bundles — policy + inventory + simulation stubs only (v1 depth).
