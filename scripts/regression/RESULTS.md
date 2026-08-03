# Live regression baselines

Rolling notes from deployed-host sweeps. Update as new loops complete.

## 2026-08-03 platform admin mutate

| Item | Result |
|------|--------|
| `ops-admin.js` | **17/17 PASS** — enrollment create/revoke, host validate, platform autostart + NIC attach/detach tasks, diagnose, NMI, rightsizing |
| `ui-admin.js` | **10/10 PASS** — enroll / hosts / users / upgrade / maintenance / api-keys |

## 2026-08-03 Zeus AI twin/graph hubs

| Item | Result |
|------|--------|
| `ops-ai.js` | **22/22 PASS** — twin/infra graph, incidents, compliance, security graphs, remediate/actions hubs |
| `ui-ai.js` | **10/10 PASS** — Zeus OS / approvals / incidents / AI providers / enterprise |

## 2026-08-03 parity / catalog batch

| Item | Result |
|------|--------|
| `ops-parity.js` | **23/23 PASS** — guest-ips/pending-config batch, policy, marketplace, upgrade, cloud-init, Atlas 503 |
| `ui-parity.js` | **13/13 PASS** — content/blueprints/marketplace/policy/upgrade/migration/devices/logs |

## 2026-08-03 guest/doctor + AI cost/capacity

| Item | Result |
|------|--------|
| `ops-guest.js` | **20/20 PASS** — domain-caps, pending-config, qemu-logs, viewer.vv, doctor/health-check |
| `ui-guest.js` | **12/12 PASS** — observability / reports / rightsizing / system-check |

## 2026-08-03 network + power

| Item | Result |
|------|--------|
| `ops-power.js` / `ui-power.js` | **11/11** / **10/10** |
| `ops-net.js` / `ui-net.js` | **19/19** / **10/10** |

## Prior fixes (deployed)

- Platform disks live fallback for adopted VMs
- Login 429 retries + UI `tryLogin`

```bash
npm run admin && npm run ui-admin
npm run ai && npm run ui-ai
npm run parity && npm run ui-parity
```
