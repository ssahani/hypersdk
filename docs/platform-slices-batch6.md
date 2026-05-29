# Platform control plane — 100 slices (batch 6)

| # | Slice | Status |
|---|-------|--------|
| 1 | Agent `CreateSnapshot` gRPC + libvirt | Done |
| 2 | Agent `DeleteSnapshot` gRPC | Done |
| 3 | Agent `ListSnapshots` gRPC | Done |
| 4 | Agent `BackupVm` gRPC (qemu-img convert) | Done |
| 5 | Worker `vm.snapshot` task | Done |
| 6 | Worker `vm.snapshot.delete` task | Done |
| 7 | Worker `vm.backup` task | Done |
| 8 | Snapshot API enqueues tasks (not stub) | Done |
| 9 | Backup API enqueues tasks | Done |
| 10 | `DELETE /api/v1/vms/{id}/snapshots/{name}` | Done |
| 11 | Migration `006_platform_batch6.sql` | Done |
| 12 | `api_keys` table + SHA-256 storage | Done |
| 13 | `webhooks` table | Done |
| 14 | `maintenance_schedules` table | Done |
| 15 | `notification_outbox` table | Done |
| 16 | Bearer API key auth (`machina_*`) | Done |
| 17 | `require_admin` / `require_operator` RBAC helpers | Done |
| 18 | `GET/POST /api/v1/users` | Done |
| 19 | `PATCH/DELETE /api/v1/users/{id}` | Done |
| 20 | `GET /api/v1/users/me` | Done |
| 21 | `GET/POST /api/v1/api-keys` | Done |
| 22 | `DELETE /api/v1/api-keys/{id}` | Done |
| 23 | `GET/POST /api/v1/webhooks` | Done |
| 24 | `DELETE /api/v1/webhooks/{id}` | Done |
| 25 | `POST /api/v1/webhooks/{id}/toggle` | Done |
| 26 | Webhook dispatch on platform events | Done |
| 27 | `GET /api/v1/projects` | Done |
| 28 | `GET /api/v1/reports/capacity` | Done |
| 29 | `GET /api/v1/metrics/prometheus` | Done |
| 30 | `GET /api/v1/health/ready` | Done |
| 31 | `GET /api/v1/openapi.json` stub | Done |
| 32 | Health includes controller version | Done |
| 33 | `POST /api/v1/tasks/{id}/retry` | Done |
| 34 | `PATCH /api/v1/vms/{id}` (desired_state, project) | Done |
| 35 | `GET /api/v1/vms/{id}/disks` | Done |
| 36 | `POST /api/v1/hosts/{id}/fence` manual fence | Done |
| 37 | `GET/POST /api/v1/maintenance/schedules` | Done |
| 38 | `DELETE /api/v1/maintenance/schedules/{id}` | Done |
| 39 | Maintenance schedule runner (60s) | Done |
| 40 | HA recovery gated on `cluster.ha_enabled` | Done |
| 41 | `DELETE /api/v1/enrollment/tokens/{token}` revoke | Done |
| 42 | Config `backup_dir` for VM backups | Done |
| 43 | Snapshot records `snapshot_path` column | Done |
| 44 | Backup records `backup_path` column | Done |
| 45 | Web: Platform Users page | Done |
| 46 | Web: Platform Webhooks page | Done |
| 47 | Web: Platform Reports page | Done |
| 48 | Web: Task retry button | Done |
| 49 | Web: Manual fence on host detail | Done |
| 50 | Web: API client for batch-6 endpoints | Done |
| 51 | Web nav: Users, Webhooks, Reports | Done |
| 52 | Agent client snapshot/backup wrappers | Done |
| 53 | Controller compiles with batch 6 | Done |
| 54 | Agent compiles with batch 6 | Done |
| 55 | Event outbox persistence on webhook fire | Done |
| 56 | Admin-only user management | Done |
| 57 | Admin-only API key management | Done |
| 58 | Admin-only webhook management | Done |
| 59 | Operator role on API keys | Done |
| 60 | Viewer role preserved in users table | Done |
| 61 | Snapshot worker updates record status | Done |
| 62 | Backup worker updates record path | Done |
| 63 | Failed snapshot marks record failed | Done |
| 64 | Failed backup marks record failed | Done |
| 65 | Platform emit_event triggers webhooks | Done |
| 66 | Scheduled maintenance queues host.maintenance | Done |
| 67 | Capacity report avg CPU | Done |
| 68 | Capacity report memory headroom | Done |
| 69 | Prometheus `machina_platform_*` gauges | Done |
| 70 | Projects grouped from VM `project` column | Done |
| 71 | OpenAPI minimal path catalog | Done |
| 72 | Readiness probe separate from liveness | Done |
| 73 | Public metrics route (no auth on health) | Done |
| 74 | Protected metrics/prometheus route | Done |
| 75 | Host detail fence uses existing DRS helper | Done |
| 76 | Enrollment token list (batch 5) retained | Done |
| 77 | Token revoke for unused joins | Done |
| 78 | VM patch without re-apply task | Done |
| 79 | Disk inventory from `vm_disks` table | Done |
| 80 | Task retry clones operation + payload | Done |
| 81 | Snapshot delete via agent + DB cleanup | Done |
| 82 | Backup full-disk qcow2 export | Done |
| 83 | Agent disk path extraction from domain XML | Done |
| 84 | libvirt snapshot via machina-core | Done |
| 85 | Scheduler spawned from controller main | Done |
| 86 | `engine/webhooks` module | Done |
| 87 | `engine/scheduler` module | Done |
| 88 | `pub mod apikeys` for auth integration | Done |
| 89 | reqwest + sha2 controller deps | Done |
| 90 | docs/platform-slices-batch6.md (this file) | Done |
| 91 | docs/platform.md cross-reference | Done |
| 92 | Batch 5 snapshot queue → agent execution | Done |
| 93 | Batch 5 backup queue → agent execution | Done |
| 94 | Web PlatformTasks failed→retry UX | Done |
| 95 | Host maintenance + fence actions coexist | Done |
| 96 | Cluster HA toggle respected in engine | Done |
| 97 | API key last_used_at tracking | Done |
| 98 | Webhook enabled toggle API | Done |
| 99 | Maintenance schedule pending filter index | Done |
| 100 | End-to-end snapshot task path wired | Done |

## Still future

- NATS multi-controller task fan-out
- Controller HA / leader election
- Full CPU compatibility matrix UI
- Native IPMI/STONITH (beyond shell fence)
- Webhook HMAC signing verification
- Snapshot restore / revert API
- OIDC integration for platform users

See also [`platform-slices.md`](platform-slices.md) (batch 5) and [`platform.md`](platform.md).
