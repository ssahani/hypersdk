# Live regression baselines

Rolling notes from deployed-host sweeps. Update as new loops complete.

## 2026-08-03 next interactive ops + UI

| Suite | Result |
|-------|--------|
| `ops-interactive.js` | **14/14 PASS** (health, pause/resume, guest-health, screenshot PNG, domain XML, autostart path, volumes, platform inventory, linked-clone-while-running rejected 400, reboot) |
| `ui-interactive.js` | **11/11 PASS** (classic Pause/Resume click, 6 platform VM tabs, Machine Finder, Cinema/ConsoleHub) — uses a dedicated CDP tab so it can run alongside page-sweep |

## 2026-08-02 → 2026-08-03 continuous (host `212.8.248.187:5092`)

| Suite | Result |
|-------|--------|
| Page sweeps (130 routes) | **120+ loops**, **0 hard fails** (see known softs) |
| API heartbeats | **8000+ loops**, **0 FAIL** |
| Chrome CDP uptime | ~13h with watchdog |

Soft-only intermittent hydrates: see `fixtures/known-softs.md`.

```bash
export MACHINA_BASE_URL=https://212.8.248.187:5092
export MACHINA_USER=sus MACHINA_PASS=max
./chrome-launch.sh &
npm run ops && npm run ui && npm run pages -- --loops 1
```
