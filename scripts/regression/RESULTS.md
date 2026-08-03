# Live regression baselines

Rolling notes from deployed-host sweeps. Update as new loops complete.

## 2026-08-03 volume CRUD + observability

| Suite | Result |
|-------|--------|
| `ops-volume.js` | **22/22 PASS** — volume create/list/delete, VM boot/console/snapshots/backups, host+guest observability, traces, pool refresh, finops |
| `ui-volume.js` | **15/15 PASS** — storage/disk-images/backups, VM+consolehub, observability/activity/fleet (API login optional on PAM rate-limit) |

## Prior waves (same host)

| Suite | Result |
|-------|--------|
| `ops-audit` / `ui-audit` | 23 / 17 |
| `ops-zeus` / `ui-zeus` | 32 / 16 |
| `ops-storage` / `ui-storage` | 23 / 17 |
| `ops-host` / `ui-host` | 34 / 19 |

```bash
export MACHINA_BASE_URL=https://212.8.248.187:5092
export MACHINA_USER=sus MACHINA_PASS=max
npm run volume && sleep 90 && npm run ui-volume
```
