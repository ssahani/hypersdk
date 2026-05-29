# Platform batch 11

Operations tuning, OIDC ES256, cross-host snapshot clone, and UI polish.

## Backend

| Item | Status |
|------|--------|
| Migration `009`: `inventory_sync_interval_secs` on clusters | Done |
| Configurable leader-only periodic inventory sync (0 = off) | Done |
| ES256 JWKS validation for OIDC id_tokens | Done |
| Snapshot clone optional `dest_host_id` → chained cold migrate | Done |
| Cluster settings expose/patch sync interval | Done |

## Web UI

| Item | Status |
|------|--------|
| Settings: leadership panel + sync interval editor | Done |
| Placement: placement policy selector (balanced/packed) | Done |
| VMs: tags on create + tags column in list | Done |
| platformFetch: friendly 429 rate-limit message | Done |

## Notes

- **Cross-host snap clone**: clones on source host, then queues `vm.migrate` (cold) to `dest_host_id`.
- **Sync interval**: default 30s; leader runs sync loop; set 0 in Settings to disable.

## Deferred

- Live migrate after snap clone
- Per-controller rate limit configuration in UI
- Host picker UI for snap-clone migrate (API supports `dest_host_id`)
