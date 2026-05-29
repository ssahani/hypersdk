# Machina Platform Runbooks

Operational playbooks for multi-host platform (libvirt/KVM).

## Host down / agent disconnected

1. Check host heartbeat: Platform → Hosts → state and `last_heartbeat_at`.
2. On the hypervisor: `systemctl status machina-agent libvirtd`.
3. Verify gRPC port (default 50051) and firewall between controller and host.
4. Re-run validation: `GET /api/v1/hosts/{id}/validate` or **Validate** in UI.
5. After agent recovery, **Sync** host inventory.

## Migration failed

1. Open VM → migration jobs or Tasks for `vm.migrate` failure message.
2. Run pre-check: `POST /api/v1/vms/{id}/migrate/precheck` with destination host.
3. Fix failing checks (memory headroom, CPU compat, maintenance mode, libvirt URI).
4. Retry migrate; use `live: false` for offline path if CPU compat blocks live migration.

## Host join validation failed

1. Review validation report on host detail (`validation_report` JSON).
2. Common fixes:
   - Start libvirtd: `systemctl start libvirtd`
   - Install qemu-kvm
   - Open migration ports 49152–49215/tcp between cluster nodes
3. Re-enqueue: `POST /api/v1/hosts/{id}/validate`.

## HA restart failed

1. Platform → HA status; check fence events.
2. Verify IPMI/shell fence credentials on host record.
3. Confirm destination host has capacity (placement recommendations).

## Agent upgrade (rolling)

1. Enter maintenance on host (optional evacuate).
2. `POST /api/v1/hosts/{id}/upgrade` with target version from `GET /api/v1/upgrade/matrix`.
3. Restart `machina-agent` on host; confirm validation passes.

## Support bundle

```bash
./scripts/platformctl support-bundle > bundle.json
```

Includes task failures, audit tail, and host version matrix for support tickets.

## Controller HA (3 nodes)

- Run 3× `machina-controller` with distinct `MACHINA_CONTROLLER_ID`.
- PostgreSQL via Patroni or managed HA Postgres.
- Only leader runs reconcile, HA, DRS, sync loops (existing leader election).
- Point all daemon instances at any controller URL or co-locate one controller per site.

See [`platform.md`](platform.md) for architecture diagram.
