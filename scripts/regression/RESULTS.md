# Live regression baselines

Rolling notes from deployed-host sweeps. Update as new loops complete.

## 2026-08-03 hardware + SOC/K8s

| Suite | Result |
|-------|--------|
| `ops-hardware.js` | **26/26 PASS** — host inventory/history, VM hardware-summary/compat/HA policy, send-key validation+esc, SOC alerts/events, AI agents, OpenStack unconfigured 400, K8s ns/nodes/pods |
| `ui-hardware.js` | **18 PASS / 1 SOFT** — platform VM+consolehub, Zeus/SOC/AI providers, K8s workloads, OpenStack (classic VM detail hydrate race) |

## 2026-08-03 mission + catalog

| Suite | Result |
|-------|--------|
| `ops-mission.js` | **20/20 PASS** |
| `ui-mission.js` | **23/23 PASS** |
| `ops-catalog.js` | **32/32 PASS** — jobs/audit, guest-health, CD-ROM guards, **network ephemeral CRUD**, HA/webhooks |
| `ui-catalog.js` | **25/25 PASS** |

## 2026-08-03 fleet + K8s/OpenStack UI

| Suite | Result |
|-------|--------|
| `ops-fleet.js` | **15/15 PASS** |
| `ui-k8s-os.js` | **22/22 PASS** |

## Cumulative suites (same host)

| Suite | Result |
|-------|--------|
| `ops-infra.js` | 20/20 |
| `ops-platform.js` | 15/15 |
| `ops-lifecycle.js` | 11/11 |
| `ops-interactive.js` | 14/14 |
| `ui-security.js` | 15/15 |
| `ui-wizards.js` | 12/12 |
| `ui-settings.js` | 15/15 |
| `ui-interactive.js` | 11/11 |

```bash
export MACHINA_BASE_URL=https://212.8.248.187:5092
export MACHINA_USER=sus MACHINA_PASS=max
./chrome-launch.sh &
npm run hardware && npm run ui-hardware
```
