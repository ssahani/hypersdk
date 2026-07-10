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
- **Backup retention prunes the DB catalog only** — on-disk backup files are not GC'd yet, so
  backup storage grows unbounded. Monitor the backup target's disk.
- **Live JWT-signing-key / agent-token rotation is not automated.** API-key rotation exists;
  rotating the JWT key or agent token requires a coordinated manual change + restart.
- **Some UI is API-only**: the health watchdog, notification channels, and cert status have
  endpoints but limited/no UI yet.
- **Snapshots require qcow2 disks** (internal snapshots); raw disks will fail snapshot ops.
- The full e2e suite still has a few failing/peripheral phases; don't treat "e2e green" as a
  release gate until those are triaged.

## 8. Upgrade procedure

1. Back up `/var/lib/machina/controller.db`.
2. `git pull` on the deploy workstation; ensure CI is green for that commit.
3. `./scripts/deploy-remote.sh <user>@<host> --platform --quick`.
4. Run the §4 verification checklist.
5. If anything regresses, roll back per §5.
