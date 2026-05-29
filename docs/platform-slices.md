# Platform control plane — 50 slices (batch 5)

Incremental features delivered in this batch. All compile and are wired controller ↔ API ↔ web unless noted.

| # | Slice | Status |
|---|-------|--------|
| 1 | `GET /api/v1/tasks` — list orchestration queue | Done |
| 2 | `POST /api/v1/tasks/{id}/cancel` — cancel pending tasks | Done |
| 3 | Task list filter by `?status=` | Done |
| 4 | `GET /api/v1/events?kind=` — filtered event stream | Done |
| 5 | `GET /api/v1/audit` — audit log API | Done |
| 6 | Health check with PostgreSQL ping | Done |
| 7 | `GET /api/v1/cluster` — cluster summary stats | Done |
| 8 | `PATCH cluster/settings` — `placement_policy` | Done |
| 9 | Extended host list (CPU, memory, fenced) | Done |
| 10 | `GET /api/v1/hosts/{id}/detail` — full host metadata | Done |
| 11 | `PATCH /api/v1/hosts/{id}` — update host fields/notes | Done |
| 12 | `DELETE /api/v1/hosts/{id}` — remove empty hosts | Done |
| 13 | `POST /api/v1/hosts/sync-all` — inventory all hosts | Done |
| 14 | Host `notes` column (migration 005) | Done |
| 15 | `GET /api/v1/vms/{id}/spec` — declarative spec JSON | Done |
| 16 | VM list `?project=` and `?host_id=` filters | Done |
| 17 | VM list includes `ha_enabled` flag | Done |
| 18 | `GET /api/v1/vms/{id}/ha` — read HA policy | Done |
| 19 | HA policy `fence_on_failure` + `anti_affinity` | Done |
| 20 | `GET /api/v1/migrations` — migration job history | Done |
| 21 | `GET /api/v1/vms/{id}/migrations` — per-VM migrations | Done |
| 22 | `GET /api/v1/fence/events` — fencing audit | Done |
| 23 | `GET /api/v1/enrollment/tokens` — list join tokens | Done |
| 24 | `DELETE /api/v1/templates/{name}/{version}` | Done |
| 25 | `DELETE /api/v1/storage/pools/{id}` | Done |
| 26 | `DELETE /api/v1/networks/{id}` | Done |
| 27 | Snapshot records table + queue API | Done |
| 28 | Backup records table + queue API | Done |
| 29 | `GET/POST /api/v1/vms/{id}/snapshots` | Done |
| 30 | `GET/POST /api/v1/vms/{id}/backups` | Done |
| 31 | Migration `005_platform_ops.sql` | Done |
| 32 | Web: Platform Tasks page + cancel | Done |
| 33 | Web: Events & Audit page | Done |
| 34 | Web: Platform Storage page | Done |
| 35 | Web: Platform Networks page | Done |
| 36 | Web: Host detail page | Done |
| 37 | Web: VM spec JSON viewer | Done |
| 38 | Web: HA fence toggle on VM detail | Done |
| 39 | Web: Snapshot/backup actions on VM detail | Done |
| 40 | Web: DRS CPU threshold slider | Done |
| 41 | Web: Placement recompute button | Done |
| 42 | Web: Migration + fence panels on Placement | Done |
| 43 | Web: Sync-all hosts button | Done |
| 44 | Web: Host CPU column + detail links | Done |
| 45 | Web: Cluster summary on dashboard | Done |
| 46 | Web: Nav entries for new platform pages | Done |
| 47 | Web: API client for all new endpoints | Done |
| 48 | Dashboard import path fixes | Done |
| 49 | `docs/platform.md` API reference update | Done |
| 50 | This slice tracker document | Done |

## Not in this batch (future)

- Agent execution for snapshot/backup tasks (queued in DB only)
- NATS multi-controller task fan-out
- Controller HA / leader election
- Full CPU compatibility matrix
- IPMI/STONITH native integrations beyond shell fence
- RBAC beyond basic admin/viewer roles

See [`platform.md`](platform.md) for architecture and quick start.
