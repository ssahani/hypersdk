# Zeus OS AI batches AI-412–431 — Storage tiers + backup SLA

> Horizon phase 27 (storage slice). vSAN-class tier taxonomy, snapshot retention stubs, backup SLA inventory.

## AI-412–416 — Schema + tiers

[`controller/migrations/028_storage_tiers.sql`](../controller/migrations/028_storage_tiers.sql):

- `storage_tiers` — gold/silver/bronze with IOPS, replication, snapshot/backup defaults
- `tier_id` on `storage_pools`
- `storage_backup_sla` per pool with compliance grade

## AI-417–420 — Engine + APIs

[`controller/src/engine/storage_tiers.rs`](../controller/src/engine/storage_tiers.rs):

- `GET /api/v1/storage/tiers/overview`
- `POST /api/v1/storage/pools/{pool_id}/tier/{tier_id}`
- `GET /api/v1/storage/backup-sla`
- `POST /api/v1/storage/pools/{id}/backup-sla`
- `GET /api/v1/storage/pools/{id}/snapshot-policy`

## AI-421–423 — UI

[`PlatformStorage.tsx`](../web/src/pages/platform/PlatformStorage.tsx) — Pools | Tiers | Backup SLA tabs with tier bind on pool cards.

## E2E

Section **STORAGE TIERS (AI-412–431)** in [`scripts/lib/e2e-platform-smoke.sh`](../scripts/lib/e2e-platform-smoke.sh).

## Out of scope

Live vSAN/CEPH replication, automated backup runners, snapshot scheduler enforcement.
