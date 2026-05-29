# Platform control plane — 100 slices (batch 7)

| # | Slice | Status |
|---|-------|--------|
| 1 | Migration `007_platform_batch7.sql` | Done |
| 2 | VM `tags` column + GIN index | Done |
| 3 | Host `tags` column + GIN index | Done |
| 4 | Cluster OIDC settings columns | Done |
| 5 | Cluster CPU compat matrix JSONB | Done |
| 6 | Backup `restore_status` column | Done |
| 7 | Notification outbox `delivered_at` | Done |
| 8 | Agent `RevertSnapshot` gRPC | Done |
| 9 | Agent `RestoreVmBackup` gRPC | Done |
| 10 | Agent heartbeat real CPU/memory | Done |
| 11 | Worker `vm.snapshot.revert` task | Done |
| 12 | Worker `vm.backup.restore` task | Done |
| 13 | `POST .../snapshots/{name}/revert` API | Done |
| 14 | `POST .../backups/{id}/restore` API | Done |
| 15 | Webhook HMAC `X-Machina-Signature` | Done |
| 16 | Webhook event filter matching | Done |
| 17 | `GET/POST /api/v1/notifications` outbox | Done |
| 18 | `POST /api/v1/notifications/{id}/deliver` | Done |
| 19 | `GET/PATCH /api/v1/auth/oidc` settings | Done |
| 20 | `GET/PATCH /api/v1/cpu-compat` matrix | Done |
| 21 | CPU compat check in migrate precheck | Done |
| 22 | Placement `packed` policy scoring | Done |
| 23 | Placement `balanced` policy (default) | Done |
| 24 | NATS fan-out `FanoutTaskBus` | Done |
| 25 | Main wires NATS when `NATS_URL` set | Done |
| 26 | `PATCH /api/v1/cluster` rename | Done |
| 27 | `PATCH /api/v1/storage/pools/{id}` | Done |
| 28 | `PATCH /api/v1/networks/{id}` | Done |
| 29 | `GET /api/v1/templates/{name}/{version}` | Done |
| 30 | `PATCH /api/v1/vms/{id}` tags support | Done |
| 31 | `PATCH /api/v1/hosts/{id}` tags support | Done |
| 32 | Audit log `?actor=` filter | Done |
| 33 | Tasks list `?operation=` filter | Done |
| 34 | `require_operator` on snapshot revert | Done |
| 35 | `require_operator` on backup restore | Done |
| 36 | hmac + hex controller deps | Done |
| 37 | Task operation index | Done |
| 38 | Audit actor index | Done |
| 39 | Events kind index | Done |
| 40 | Web: Platform Projects page | Done |
| 41 | Web: Platform Notifications page | Done |
| 42 | Web: Platform Settings page | Done |
| 43 | Web: VM snapshot revert button | Done |
| 44 | Web: VM backup restore button | Done |
| 45 | Web: VM disk inventory section | Done |
| 46 | Web: VM tags editor | Done |
| 47 | Web: Host notes editor | Done |
| 48 | Web: Enroll token revoke | Done |
| 49 | Web: Webhook toggle/delete | Done |
| 50 | Web: User delete button | Done |
| 51 | Web: API key last-used column | Done |
| 52 | Web: Task operation filter | Done |
| 53 | Web: Audit actor filter | Done |
| 54 | Web nav: Projects, Notifications, Settings | Done |
| 55 | platform.ts batch-7 API client | Done |
| 56 | Agent libvirt snapshot revert | Done |
| 57 | Agent qemu-img backup restore | Done |
| 58 | Agent host stats via `/proc` | Done |
| 59 | Controller compiles batch 7 | Done |
| 60 | Agent compiles batch 7 | Done |
| 61 | Snapshot revert emits event | Done |
| 62 | Backup restore updates restore_status | Done |
| 63 | Outbox insert on webhook dispatch | Done |
| 64 | OIDC admin-only patch | Done |
| 65 | CPU matrix admin-only patch | Done |
| 66 | Cluster rename admin-only | Done |
| 67 | Storage pool capacity patch | Done |
| 68 | Network vlan/bridge patch | Done |
| 69 | Template detail read API | Done |
| 70 | VM list returns tags | Done |
| 71 | VM get returns tags | Done |
| 72 | Host patch notes (batch 5) + tags | Done |
| 73 | Fanout publishes local + NATS | Done |
| 74 | NATS connect failure graceful fallback | Done |
| 75 | Webhook wildcard event prefix match | Done |
| 76 | Empty webhook events = deliver all | Done |
| 77 | Notification undelivered filter | Done |
| 78 | Settings CPU matrix JSON editor | Done |
| 79 | Settings OIDC enable toggle | Done |
| 80 | Projects page links to VM filter | Done |
| 81 | docs/platform-slices-batch7.md (this file) | Done |
| 82 | docs/platform.md cross-reference | Done |
| 83 | Batch 6 snapshot delete retained | Done |
| 84 | Batch 6 task retry retained | Done |
| 85 | Restore stops VM before disk overwrite | Done |
| 86 | Restore restarts VM if was running | Done |
| 87 | Revert uses machina-core libvirt | Done |
| 88 | CPU compat default permissive | Done |
| 89 | Packed placement prefers fuller hosts | Done |
| 90 | Balanced placement headroom scoring | Done |
| 91 | Web build passes batch 7 | Done |
| 92 | OpenAPI stub retained | Done |
| 93 | Health version retained | Done |
| 94 | Prometheus metrics retained | Done |
| 95 | HA engine unchanged compatible | Done |
| 96 | DRS auto-migrate uses new placement | Done |
| 97 | Maintenance schedules retained | Done |
| 98 | API keys Bearer auth retained | Done |
| 99 | Enrollment revoke API wired | Done |
| 100 | End-to-end revert task path wired | Done |

## Still future

- Full OIDC login flow / JWT validation
- Controller HA / leader election (NATS consumer)
- Native IPMI/STONITH beyond shell fence
- Snapshot restore to new VM (clone-from-snap)
- Webhook delivery retry with backoff
- Rate limiting middleware
- VM tag-based placement rules

See also [`platform-slices-batch6.md`](platform-slices-batch6.md) and [`platform.md`](platform.md).
