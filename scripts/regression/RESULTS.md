# Live regression baselines

Rolling notes from deployed-host sweeps. Update as new loops complete.

## 2026-08-03 lifecycle + settings

| Suite | Result |
|-------|--------|
| `ops-lifecycle.js` | **11/11 PASS** — volume create → attach `vdb` → detach → delete; NIC attach/detach; stop/start; rename round-trip; linked clone + cleanup; platform VM detail |
| `ui-settings.js` | **15/15 PASS** — `/settings`, platform settings/users/zeus/hosts/networks/storage, fleet, node, audit |

First lifecycle attempt orphaned a deleted volume in domain XML (attach succeeded in config; detach-before-delete order now enforced; XML verified). Host recovered before re-run.

## 2026-08-03 interactive ops + UI

| Suite | Result |
|-------|--------|
| `ops-interactive.js` | **14/14 PASS** |
| `ui-interactive.js` | **11/11 PASS** |

## Continuous page/API (same host)

Page sweeps **120+** loops / **0 hard fails**; API **8000+** loops clean. Softs: `fixtures/known-softs.md`.

```bash
export MACHINA_BASE_URL=https://212.8.248.187:5092
export MACHINA_USER=sus MACHINA_PASS=max
./chrome-launch.sh &
npm run ops && npm run lifecycle && npm run ui && npm run ui-settings
```
