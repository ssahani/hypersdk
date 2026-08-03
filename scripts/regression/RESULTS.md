# Live regression baselines

Rolling notes from deployed-host sweeps. Update as new loops complete.

## 2026-08-03 Zeus AI twin/graph hubs

| Item | Result |
|------|--------|
| `ops-ai.js` | **22/22 PASS** — twin/infra graph, incidents, compliance, security/services graphs, remediate/actions hubs, cost budget/attribution, routing/agents |
| `ui-ai.js` | **10/10 PASS** — Zeus OS / approvals / incidents / configure / AI providers / enterprise |

## 2026-08-03 parity / catalog batch

| Item | Result |
|------|--------|
| `ops-parity.js` | **23/23 PASS** — guest-ips/pending-config batch, policy, marketplace, upgrade, cloud-init validate, CSV exports, Atlas disabled 503 |
| `ui-parity.js` | **13/13 PASS** — content/blueprints/marketplace/policy/upgrade/migration/devices/logs |

## 2026-08-03 guest/doctor + AI cost/capacity

| Item | Result |
|------|--------|
| `ops-guest.js` | **20/20 PASS** — domain-caps, pending-config, qemu-logs, viewer.vv, doctor/health-check, host linux/cockpit, Jarvis/cost/capacity |
| `ui-guest.js` | **12/12 PASS** — observability / reports / rightsizing / host+VM detail / system-check |

## 2026-08-03 network cross-layer + power NICs hard

| Item | Result |
|------|--------|
| `ops-power.js` | **11/11 PASS** — classic + platform pause/resume, disks, **hard** nics |
| `ui-power.js` | **10/10 PASS** — VM detail / consolehub / tasks / mission-control |
| `ops-net.js` | **19/19 PASS** — classic nic attach/detach ↔ platform nics |
| `ui-net.js` | **10/10 PASS** — networks / HA / SOC / events / GPU / webhooks |

## Prior fixes (deployed)

- Platform disks live fallback for adopted VMs (`vda` verified)
- Login 429 retries + UI `tryLogin`

```bash
npm run ai && npm run ui-ai
npm run parity && npm run ui-parity
npm run guest && npm run ui-guest
```
