# Live regression baselines

Rolling notes from deployed-host sweeps. Update as new loops complete.

## 2026-08-03 operations / developer hub

| Item | Result |
|------|--------|
| `ops-ops.js` | **29/29 PASS** — developer/support/runbooks/fleet desktop/watchdog, guest agent negatives, AI timeline/twin impact |
| `ui-ops.js` | **10/10 PASS** — developer / support / operations / observability / api-docs / mission-control |

## 2026-08-03 platform admin mutate

| Item | Result |
|------|--------|
| `ops-admin.js` | **17/17 PASS** — enrollment, platform autostart + NIC tasks, diagnose, NMI |
| `ui-admin.js` | **10/10 PASS** — enroll / hosts / users / upgrade / maintenance |

## 2026-08-03 Zeus AI twin/graph hubs

| Item | Result |
|------|--------|
| `ops-ai.js` | **22/22 PASS** — twin/infra graph, incidents, compliance, remediate/actions hubs |
| `ui-ai.js` | **10/10 PASS** — Zeus OS / approvals / incidents / AI providers |

## 2026-08-03 parity / catalog batch

| Item | Result |
|------|--------|
| `ops-parity.js` | **23/23 PASS** — batch IPs/pending-config, policy, marketplace, upgrade, Atlas 503 |
| `ui-parity.js` | **13/13 PASS** — content/blueprints/marketplace/policy/upgrade/devices/logs |

## Earlier (same day)

| Suite | Result |
|-------|--------|
| `ops-guest` / `ui-guest` | **20/20** / **12/12** |
| `ops-power` / `ui-power` | **11/11** / **10/10** |
| `ops-net` / `ui-net` | **19/19** / **10/10** |

```bash
npm run operations && npm run ui-operations
npm run admin && npm run ui-admin
npm run ai && npm run ui-ai
```
