# Live regression baselines

Rolling notes from deployed-host sweeps. Update as new loops complete.

## 2026-08-03 platform + wizards

| Suite | Result |
|-------|--------|
| `ops-platform.js` | **15/15 PASS** — boot/memtune/cputune, tags round-trip, snapshots list, jobs/backups/audit, platform VNC + ConsoleHub plan, snapshot **precheck only** (no create), host sync task, platform pause/resume tasks, KubeVirt detail + console `400 vm has no host` |
| `ui-wizards.js` | **12/12 PASS** — `/create`, `/import`, platform builders/templates/migration, OpenStack create/images/flavors |

## Prior suites (same host)

| Suite | Result |
|-------|--------|
| `ops-lifecycle.js` | **11/11 PASS** |
| `ops-interactive.js` | **14/14 PASS** |
| `ui-interactive.js` | **11/11 PASS** |
| `ui-settings.js` | **15/15 PASS** |

Continuous page/API still running (occasional SOFT/CDP contention when UI tests share Chrome).

```bash
export MACHINA_BASE_URL=https://212.8.248.187:5092
export MACHINA_USER=sus MACHINA_PASS=max
./chrome-launch.sh &
npm run platform && npm run ui-wizards
```
