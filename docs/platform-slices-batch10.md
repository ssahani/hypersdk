# Platform batch 10

Hardening OIDC, non-destructive snapshot clone, multi-controller sync, and rate-limit improvements.

## Backend

| Item | Status |
|------|--------|
| OIDC id_token JWKS signature validation (`oidc_jwt.rs`) | Done |
| Agent `CloneFromSnapshot` gRPC (qemu-img `-s` or revert+clone) | Done |
| Snapshot create stores `disk_path` on record | Done |
| `vm.snapshot.clone` creates DB VM row + `revert_source` flag | Done |
| Periodic host sync leader-gated | Done |
| Per-IP rate limit via `ConnectInfo` + dual auth/ip buckets | Done |
| `GET /api/v1/cluster/leadership` | Done |

## Web UI

| Item | Status |
|------|--------|
| Snapshot clone: optional destructive revert confirm | Done |

## Notes

- **Non-destructive clone** (default): `qemu-img convert -s <snap> <disk> <new_disk>` then defines a new libvirt domain. Source VM unchanged.
- **Destructive clone** (`revert_source=true`): libvirt revert + domain clone (batch 9 behavior).
- **JWKS**: validates RS256 id_tokens when provider exposes `jwks_uri`; falls back to unverified parse on failure.
- **Rate limit**: authenticated requests count against both auth and client IP buckets.

## Deferred

- EC/ES256 JWKS keys
- Automatic inventory sync interval configuration
- Clone-from-snap to alternate host
