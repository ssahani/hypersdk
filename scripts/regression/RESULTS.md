# Live regression baselines

Rolling notes from deployed-host sweeps. Update as new loops complete.

## 2026-08-03 storage + health

| Suite | Result |
|-------|--------|
| `ops-storage.js` | **23/23 PASS** — daemon health/problems, auth session, controller health/ready, storage pools live + tiers + backup-sla + discover, networks live + discover, backups timeline, prometheus, VM logs/consolehub |
| `ui-storage.js` | **17/17 PASS** — classic storage/networks/backups + platform storage/networks/backups/observability/storage-atlas |

## Prior waves (same host)

| Suite | Result |
|-------|--------|
| `ops-host` / `ui-host` | 34 / 19 |
| `ops-hardware` / `ui-hardware` | 26 / 18+1 soft |
| `ops-catalog` / `ui-catalog` | 32 / 25 |
| `ops-mission` / `ui-mission` | 20 / 23 |

```bash
export MACHINA_BASE_URL=https://212.8.248.187:5092
export MACHINA_USER=sus MACHINA_PASS=max
./chrome-launch.sh &
npm run storage && npm run ui-storage
```
