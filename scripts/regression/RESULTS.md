# Live regression baselines

Rolling notes from deployed-host sweeps. Update as new loops complete.

## 2026-08-02 → 2026-08-03 continuous (host `212.8.248.187:5092`)

| Suite | Result |
|-------|--------|
| Page sweeps (130 routes) | **80+ loops**, ~10k+ page visits, **0 hard fails** |
| API heartbeats (13 endpoints + pause/resume) | **5000+ loops**, **0 fails** |
| Chrome CDP uptime | ~8h+ with watchdog reconnect |

Soft-only intermittent hydrates: see `fixtures/known-softs.md`.

Commands used:

```bash
export MACHINA_BASE_URL=https://212.8.248.187:5092
export MACHINA_USER=sus MACHINA_PASS=max
./chrome-launch.sh &
node page-sweep.js --forever
node api-sweep.js --forever
```
