# Production Deployment & Readiness Runbook

Operator guide for deploying Machina at a customer site. Written from a real deploy +
verification pass — including the failure modes that actually bit us. **Read the "Known
limitations" section before promising a customer this runs unattended.**

---

## 1. Prerequisites (per KVM host)

- Ubuntu 22.04/24.04 (or comparable), root/sudo.
- `libvirtd` + KVM running, a libvirt storage pool with capacity for VM disks, and the
  `default` libvirt network active.
- Build deps (the installer installs these): `libvirt-dev pkg-config protobuf-compiler
  libclang-dev clang libssl-dev qemu-kvm virtinst`.
- `openssl` (used to generate secrets).
- Ports: controller `:5093`, daemon/UI `:5092`, agent gRPC `:50051`, console `:50052`.
- Outbound network if you want alert channels to reach Slack/SMTP.

## 2. Secrets — MANDATORY (the controller refuses to boot without them)

The controller has a boot-guard: it **will not start** on the dev-default JWT secret or the
default `admin` password. As of the deploy-hardening change, `install-platform.sh` now
**auto-generates** strong values on first install and **preserves them on re-deploy**:

- `MACHINA_JWT_SECRET` — signs platform JWTs (bridges controller ↔ daemon).
- `MACHINA_AGENT_TOKEN` — authenticates controller ↔ agent gRPC and the console port.
- `MACHINA_ADMIN_PASSWORD` — seeds the bootstrap `admin` user (printed once at install — **save it**).

They live in `/etc/default/machina-platform` (mode 0600). To rotate an **API key**, use
`POST /api/v1/api-keys/{id}/rotate`. (Live JWT-signing-key rotation is not yet automated —
see Known limitations.)

> Historical footgun (now fixed): a `--platform` re-deploy used to overwrite this file and
> wipe the secrets, taking the controller down. If you're on an older build, keep secrets in
> a systemd drop-in (`/etc/machina/secrets.env` + `…​.service.d/10-secrets.conf`) so an
> install can't clobber them.

## 3. Deploy

From a workstation with the repo (and the sibling `guestkit` repo checked out beside it):

```bash
./scripts/deploy-remote.sh <user>@<host> --platform --quick
```

`--platform` installs/updates **controller + agent** (`--quick` alone only updates the
daemon). The build runs **on the host** (rsync → cargo/npm build → install → systemd). First
build is slow; subsequent `--quick` builds are incremental.

## 4. Post-deploy verification (do every deploy)

```bash
# services + health
ssh <user>@<host> 'systemctl is-active machina-controller machina-agent machina-daemon libvirtd'
curl -s -o /dev/null -w '%{http_code}\n' http://<host>:5093/api/v1/health          # 200
# migrations applied (new tables present)
ssh <host> 'sudo sqlite3 /var/lib/machina/controller.db ".tables"'
# controller ↔ agent working (host online, VMs listed)
curl -su admin:<pw> http://<host>:5093/api/v1/vms
# console token gate (agent :50052): no/wrong token -> 401, right token -> 101
# cert status
curl -su admin:<pw> http://<host>:5093/api/v1/cert-status
```

If the controller is in a restart loop, check the journal for
`Refusing to start:` — a secret is missing/default.

## 5. Rollback

Every install keeps the previous binaries. To revert a bad deploy:

```bash
ssh <host> 'sudo cp -f /usr/local/bin/machina-controller.prev /usr/local/bin/machina-controller \
  && sudo cp -f /usr/local/bin/machina-agent.prev /usr/local/bin/machina-agent \
  && sudo systemctl restart machina-controller machina-agent'
```

(The SQLite DB is not rolled back; migrations are additive. Back up
`/var/lib/machina/controller.db` before a risky upgrade.)

## 6. Optional integrations

- **Alert channels** (Slack/email): `POST /api/v1/notification-channels` (`kind`:
  `slack`|`email`|`webhook`). Email needs SMTP env: `MACHINA_SMTP_HOST`, `_PORT`, `_FROM`,
  `_USER`, `_PASS`. Use `/notification-channels/{id}/test` to confirm wiring.
- **Threshold alerts**: `POST /api/v1/alert-rules` (feeds the channels).
- **Backups**: `POST /api/v1/backup-schedules`. **Targets** (`/backup-targets`) for offsite.
- **TLS**: default cert is self-signed (browsers won't trust it) — install a real CA cert at
  `/etc/machina/ssl/cert.pem` (+ key). `cert-status` / the cert monitor warn 30 days before
  expiry via the channels.

## 7. Known limitations (be honest with the customer)

These are real gaps observed in verification — a customer should know them up front:

- **CI branch protection is not enforced automatically.** CI now gates on build + tests, but
  you must enable branch protection on `main` (Settings → Branches) so red CI actually blocks
  merges. Without it, broken code can still land.
- **`fmt`/`clippy` are advisory in CI** (large pre-existing backlog); they don't block yet.
- **Metrics reliability.** `vm_metrics` (esp. guest memory) is only populated when the guest
  agent reports it; on VMs without a fully-reporting agent it can read 0 intermittently. This
  makes **threshold alerts, capacity/rightsizing, and the memory-based watchdog signal**
  unreliable until guest tooling is consistently installed and reporting.
- **Live JWT-signing-key / agent-token rotation is not automated.** API-key rotation exists;
  rotating the JWT key or agent token requires a coordinated manual change + restart.
- **Some UI is API-only**: the health watchdog, notification channels, and cert status have
  endpoints but limited/no UI yet.
- **Snapshots require qcow2 disks** (internal snapshots); raw disks will fail snapshot ops.
- The full e2e suite still has a few failing/peripheral phases; don't treat "e2e green" as a
  release gate until those are triaged.

## 7a. KNOWN CRITICAL correctness gaps — data-path audit 2026-07-11 (read before a customer deploy)

A focused audit of the code paths that decide where VMs run and how their data is protected
found architectural issues that are **not yet fixed** (they need design work, not one-line
patches). The bounded, high-confidence ones from the same audit **were** fixed (commit
`a6c0153f`: restore ownership/completeness guard, restore path allow-list, multi-disk
refuse-instead-of-lose, HA/evac `schedulable` + `desired_state` filters, firewall authz).
What remains:

- **HA can split-brain a VM under a network partition (CRITICAL).** A host is marked `offline`
  purely on heartbeat loss (>90s). A controller↔agent partition (VMs still running) then makes
  HA re-create + start those VMs on a survivor while they run on the partitioned host — both
  writing the same shared storage → corruption. Fencing does not save this today because…
- **Fencing is routed through the *target host's own agent* (CRITICAL).** A truly-dead host
  can't be fenced (its agent is gone), so `fence_on_failure` VMs are never recovered on real
  hardware death, while non-fenced VMs split-brain. Real fencing must originate from the
  controller/BMC, independent of the failed host.
- **Migration/evacuation never undefines the source domain.** With `PERSIST_DEST`, an evacuated
  VM with libvirt autostart can boot on the source at next power-on while running on the
  destination → split-brain. Evacuation should undefine the source.
- **`host.maintenance` reports the host "drained" while evacuations are async/best-effort.** An
  operator can pull a host that still has running VMs. Don't power-cycle a host on the strength
  of the maintenance flag alone — confirm no running VMs remain first.
- **Backups of a running VM are crash-consistent only by luck.** `qemu-img convert` copies the
  live qcow2 with no `FSFreeze`/snapshot/pause, and integrity is not verified before the record
  is marked `completed`. Treat backups of busy/DB VMs as potentially inconsistent; prefer
  snapshot-then-backup, and test-restore before relying on any backup.
- **"Incremental" backups build a fragile chain and retention can delete the base**, making the
  retained incremental unrestorable. Use full backups until this is reworked.
- **Deleting an external snapshot of a running VM leaks the overlay qcow2 on disk** (metadata-
  only delete). With scheduled snapshots this slowly consumes the pool; monitor pool usage.
- **Two active leaders are possible** if the leader-lease renewal stalls past the lease (the
  cached `is_leader()` isn't re-validated against `lease_until`), which would duplicate
  HA/DRS/reconcile actions. Low probability, no fencing token to stop the loser's writes.
- No anti-affinity (replicas can be co-located, defeating HA); DRS has no hysteresis (ping-pong
  risk). Both are feature gaps, not regressions.

**Bottom line for a customer:** single-host or quiet multi-host operation is in reasonable
shape after the fixes, but **HA/fencing under a real host failure or network partition is not
safe yet**, and **backup/restore of busy VMs is not proven**. Do a restore drill and avoid
relying on automatic HA failover until the fencing model is reworked.

## 8. Upgrade procedure

1. Back up `/var/lib/machina/controller.db`.
2. `git pull` on the deploy workstation; ensure CI is green for that commit.
3. `./scripts/deploy-remote.sh <user>@<host> --platform --quick`.
4. Run the §4 verification checklist.
5. If anything regresses, roll back per §5.
