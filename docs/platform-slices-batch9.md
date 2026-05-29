# Platform batch 9

Follow-up to batch 8: NATS task consumption, webhook delivery visibility, HA fixes, placement tags, rate limiting, snapshot clone.

## Backend

| Item | Status |
|------|--------|
| NATS subscriber forwards `machina.tasks` to local worker queue | Done |
| Task worker conditional claim (`pending` → `running`) for multi-instance dedup | Done |
| Webhook worker gated on controller leader election | Done |
| `GET /api/v1/webhook-deliveries` + `POST .../{id}/retry` | Done |
| Rate limit middleware on authenticated API (300 req/min per auth header) | Done |
| Tag-aware host pick on VM create (`pick_host_for_vm`) | Done |
| Tag affinity bonus in DRS placement scoring | Done |
| `POST /api/v1/vms/{id}/snapshots/{name}/clone` + `vm.snapshot.clone` task | Done |

## Web UI

| Item | Status |
|------|--------|
| Dashboard leader / controller_id badge | Done |
| Webhooks page: delivery list, status filter, manual retry | Done |
| VM detail: clone-from-snapshot action | Done |

## Notes

- **Snapshot clone** reverts the source VM to the snapshot, then clones libvirt domain to `new_name`. Source VM disk state is changed.
- **NATS**: publisher still fans out locally + NATS; subscribers on all controller instances receive remote tasks; only one worker claims each task in PostgreSQL.
- **Rate limit**: keys on `Authorization` header when present, else `X-Forwarded-For`, else shared `anon` bucket.

## Deferred

- Non-destructive snapshot clone (linked disk without revert)
- Per-IP rate limits without reverse proxy headers
- OIDC JWKS / full id_token validation
