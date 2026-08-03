# Live regression baselines

Rolling notes from deployed-host sweeps. Update as new loops complete.

## 2026-08-03 infra + security UI

| Suite | Result |
|-------|--------|
| `ops-infra.js` | **20/20 PASS** — networks/nwfilters/secrets, node, capabilities, pool refresh, VM metrics + history, platform health/host/networks/storage/notifications/alerts/webhooks, AI fleet summary + providers, Zeus firewall status |
| `ui-security.js` | **15/15 PASS** — Zeus security/* (hunt/firewall/ports/compliance/policies), SOC, policy, webhooks, alert-rules, HA, placement |

## Prior suites (same host)

| Suite | Result |
|-------|--------|
| `ops-platform.js` | **15/15** |
| `ui-wizards.js` | **12/12** |
| `ops-lifecycle.js` | **11/11** |
| `ops-interactive.js` | **14/14** |
| `ui-interactive.js` | **11/11** |
| `ui-settings.js` | **15/15** |

```bash
export MACHINA_BASE_URL=https://212.8.248.187:5092
export MACHINA_USER=sus MACHINA_PASS=max
./chrome-launch.sh &
npm run infra && npm run ui-security
```
