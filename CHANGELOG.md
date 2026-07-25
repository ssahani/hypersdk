# Changelog

## 2026-07-23 – 2026-07-25 — Security & correctness hardening marathon

Over three days, a multi-wave audit swept the entire Machina codebase — the full
Rust workspace (`core`, `daemon`, `controller`, `agent`, `tui`, `spec`,
`translate`, `rvb`, `virt-image-build`), the web frontend, ~90 shell/deploy
scripts, SQL migrations, CI, the Kubernetes/Helm chart, Docker, and the
Windows/Linux golden-image pipelines. **360+ discrete bugs** were found and
fixed across **19 waves**, each independently verified (`cargo check`/
`cargo test --workspace` on a Linux build host, `tsc --noEmit`/`vitest run`
for web changes, `bash -n`/`helm lint` where applicable) before merging.

Four dedicated self-review passes (waves 14/16/17/18/19) re-audited prior
waves' own fixes rather than hunting new ground, and found a real,
verifiable gap in **every single pass** — most notably an HA-recovery
`host_id`-revert compensation path (added in wave 14) that took **five
follow-up waves** to fully close off across seven independent bypass
routes (task retry, task cancel, task-bus republish failure, and two
startup crash-reapers).

### Highlights (most severe findings)

- **Sendmail flag injection** (wave 19) — a notification-channel email
  address, fully attacker/operator-controlled and validated only for `@`
  and no whitespace, reached `sendmail` as a bare positional argument. A
  value like `-C/tmp/evil.cf@x` was a working flag-injection primitive.
- **HA-recovery `host_id` never reverted on failure** (waves 14, 16, 17,
  18, 19) — an HA failover writes the destination `host_id` before its
  recovery task exists, so any way to fail/cancel/retry/crash out of that
  task without reverting it permanently stranded the VM's control-plane
  record. Closed across 7 independent code paths.
- **Zeus firewall `force`-flag authz gap** (wave 12) — bypassing the
  firewall-change approval gate required only `operator`, unlike every
  sibling "skip the safety gate" action in the same file.
- **Fail-open migration/health prechecks** (wave 16, confirmed a prior
  flag) — an unreachable source host or guest agent during a migration
  precheck or VM health check silently produced a passing/healthy result
  instead of blocking or flagging degraded state.
- **Host-cockpit privilege escalation** (wave 19) — an operator-gated
  endpoint forwarded an unrestricted action string to the same agent RPC
  its sibling endpoint correctly gates behind `require_admin`, reaching
  `storage.pool.delete`/`storage.volume.delete`/`network.delete`.
- **Unauthenticated plaintext-credential leaks** (waves 15, 19) — VM
  domain-XML (embeds VNC/SPICE passwords), host process lists (leak
  secrets via `/proc/<pid>/cmdline`), and RBAC role enumeration were all
  reachable with no role check, unlike their guarded siblings.
- **Atlas backup/snapshot/restore false success** (wave 14) — task
  handlers marked DB records `'completed'` the instant Atlas *accepted*
  a job (202), without polling to a terminal state; a failed Atlas-side
  operation silently reported success.
- **Zeus firewall temporary rules never enforced** (waves 17/18) — a
  "break-glass" temporary rule was recorded as `applied: true` and shown
  as live/auto-expiring, but no code path ever pushed it to a host
  firewall. Now honestly reported as audit-only.
- **CSV/YAML export injection** (waves 15/16) — exported VM/team/cost
  names starting with `=`/`+`/`-`/`@` could execute as a spreadsheet
  formula on open (CWE-1236); YAML exports interpolated names unescaped.
- **Helm chart hardcoded JWT secret** (wave 16) — `values.yaml` shipped
  `jwtSecret: "change-me-in-production"` as a literal default, which the
  daemon (unlike its own known dev secret) would accept as genuine,
  letting anyone forge admin tokens on an unmodified deployment.
- **Command-injection in remote deploy/install scripts** (waves 13, 19) —
  unquoted variables spliced into root SSH command strings
  (`install.sh --bind`, `deploy-remote.sh`'s license-key export), and a
  systemic sweep of every `Command::new`/`virsh`/`systemctl`/`nmcli`/
  `sendmail` call site for the "leading `-` as flag injection" pattern.
- **Unverified golden-image supply chain** (wave 15) — the Ubuntu
  desktop golden-image build downloaded the base cloud image over HTTPS
  with no checksum verification before using it as every VM's base.
- **Graceful shutdown gap** (wave 15) — the daemon's TLS (production)
  listener never wired up graceful shutdown; SIGTERM hard-killed
  in-flight VNC/SPICE/SSH console sessions instead of draining them.
- **OIDC hardening** (wave 18) — no timeout on IdP HTTP calls (could
  hang auth handlers indefinitely), and no issuer-pinning check on the
  fetched discovery document (OIDC Discovery 1.0 §4.3).
- **RCE in e2e test infrastructure** (wave 11) — a guest-exec helper's
  mismatched shell-escaping allowed command injection when a test VM's
  guest script contained an apostrophe.
- **Live VNC console regression** (self-caught same day) — a bundled
  vs. system noVNC version mismatch broke console fallback; found via
  live browser verification and fixed within the same session.

### Wave-by-wave summary

| Wave | Date (UTC-ish) | Commit | Fixes | Focus |
|---|---|---|---|---|
| — | 2026-07-23 21:06 | `23f51dbd` | — | Pre-marathon: closed daemon/controller authz gaps, hardened secrets, fixed task-delivery bugs |
| 1 | 2026-07-24 07:04 | `0df82f91` | 65 | Broad sweep: daemon, controller, core, agent, tui, web |
| 2 | 2026-07-24 08:19 | `18caf8a9` | 55 | Second broad wave: controller, daemon, spec, web |
| 3a | 2026-07-24 14:38 | `fbe6fc3d` | 3 | Partial: URL-encoding gaps, CSV injection |
| 3 | 2026-07-24 15:49 | `ffcf7e13` | 19 | Agent crate, web api/utils, deploy scripts |
| 4 | 2026-07-24 18:17 | `f4ae5c36` | 22 | Dedicated re-review of highest-value files |
| 5 | 2026-07-24 18:40 | `32acc7e1` | 4 | Cross-file and cross-layer deep reviews |
| 6 | 2026-07-24 19:08 | `a15089e3` | 6 | Security headers, rate limiting, systemd hardening, deps |
| — | 2026-07-24 20:13 | `e6ae7591` | 1 | Live VNC console regression hotfix |
| 7 | 2026-07-24 20:56 | `36a0ffbe` | 8 | Daemon rate limiting, cookie hardening, second passes |
| 8 | 2026-07-24 22:12 | `91e00ab8` | 17 | CI, K8s chart, Docker, Windows golden image, polkit |
| 9 | 2026-07-24 23:26 | `81a70da7` | 13 | K8s/observability configs, example configs, docs drift |
| 10 | 2026-07-25 00:02 | `2a165be2` | 15 | machinactl, privileged scripts, e2e test quality |
| 11 | 2026-07-25 00:12 | `87068167` | 6 | Remaining e2e/bundle scripts, incl. one real RCE |
| 12 | 2026-07-25 00:34 | `7748e958` | 1 | Zeus firewall force-flag authz gap |
| 13 | 2026-07-25 11:21 | `27b526eb` | 21 | AI engine, agent, TUI, spec/translate, deploy scripts |
| 14 | 2026-07-25 12:29 | `1a7cf65b` | 16 | HA/DRS, task bus, JWT auth, daemon routes, Atlas, bootstrap race |
| 15 | 2026-07-25 13:50 | `a529d49f` | 18 | API authz, agent RPC timeouts, graceful shutdown, supply chain |
| 16 | 2026-07-25 14:12 | `cf641483` | 14 | Fail-open precheck bugs, Helm secret default, CSV/YAML injection, KubeVirt false success |
| 17 | 2026-07-25 14:47 | `f07077e1` | 17 | Core crate first pass, console session lifecycle, HA revert gaps |
| 18 | 2026-07-25 15:36 | `145ddb4d` | 11 | 6th HA-revert bypass, OIDC hardening, firewall honesty, glass/hooks |
| 19 | 2026-07-25 18:27 | `ae8e608e` | 34 | Sendmail flag injection, 7th HA-revert bypass, host-cockpit privilege escalation, systemic argv sweep |

Fix counts are as documented in each wave's commit message; the session's
own running tally (quoted informally as work progressed) landed a little
higher (~385) after accounting for extra fixes self-review passes found
inside a wave that weren't reflected in that wave's headline count.

For full technical detail on any fix, see the corresponding commit message
(`git show <hash>`) — each documents the specific bug, the failure
scenario, and the fix applied.
