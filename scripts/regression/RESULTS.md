# Live regression baselines

Rolling notes from deployed-host sweeps. Update as new loops complete.

## 2026-08-02 → 2026-08-03 continuous (host `212.8.248.187:5092`)

| Suite | Result |
|-------|--------|
| Page sweeps (130 routes) | **80 completed loops**, **10385 PASS / 15 SOFT / 0 FAIL** |
| API heartbeats (13 endpoints + pause/resume) | **5564 loops**, **0 FAIL lines** |
| Chrome CDP uptime | ~8h+ with watchdog reconnect |

Soft-only intermittent hydrates: see `fixtures/known-softs.md`.

Maintained runners (in-repo):

```bash
export MACHINA_BASE_URL=https://212.8.248.187:5092
export MACHINA_USER=sus MACHINA_PASS=max
./chrome-launch.sh &
node page-sweep.js --forever
node api-sweep.js --forever
```

Historical one-off rounds: `archive/`.
