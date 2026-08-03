# Live regression baselines

Rolling notes from deployed-host sweeps. Update as new loops complete.

## 2026-08-03 Zeus deep + API keys

| Suite | Result |
|-------|--------|
| `ops-zeus.js` | **32/32 PASS** — Zeus overview/profiles/k8s/baremetal/finops/cloud, target ports/score/drift, host cordon toggle, **API key CRUD**, webhook private reject + public CRUD, **nwfilter CRUD** |
| `ui-zeus.js` | **16/16 PASS** — API keys/webhooks, Zeus k8s/cloud/connectivity/compliance/hunt, host machine detail |
| `lib/api.js` | login now fails loudly on 429/missing cookie |

## Prior waves (same host)

| Suite | Result |
|-------|--------|
| `ops-storage` / `ui-storage` | 23 / 17 |
| `ops-host` / `ui-host` | 34 / 19 |
| `ops-hardware` / `ui-hardware` | 26 / 18+1 soft |
| `ops-catalog` / `ui-catalog` | 32 / 25 |
| `ops-mission` / `ui-mission` | 20 / 23 |

```bash
export MACHINA_BASE_URL=https://212.8.248.187:5092
export MACHINA_USER=sus MACHINA_PASS=max
./chrome-launch.sh &
npm run zeus && npm run ui-zeus
```
