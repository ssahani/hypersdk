# Live regression baselines

Rolling notes from deployed-host sweeps. Update as new loops complete.

## 2026-08-03 audit + compliance + terminal

| Suite | Result |
|-------|--------|
| `ops-audit.js` | **23/23 PASS** — platform/daemon audit, templates/users/projects, terminal session create + validation, Zeus simulate/connectivity/CIS/PCI, SIEM export, PacketWolf, autostart toggle |
| `ui-audit.js` | **17/17 PASS** — audit/logs/create/import, platform templates/users/projects, compliance/connectivity |

## Prior waves (same host)

| Suite | Result |
|-------|--------|
| `ops-zeus` / `ui-zeus` | 32 / 16 |
| `ops-storage` / `ui-storage` | 23 / 17 |
| `ops-host` / `ui-host` | 34 / 19 |
| `ops-hardware` / `ui-hardware` | 26 / 18+1 soft |
| `ops-catalog` / `ui-catalog` | 32 / 25 |
| `ops-mission` / `ui-mission` | 20 / 23 |

```bash
export MACHINA_BASE_URL=https://212.8.248.187:5092
export MACHINA_USER=sus MACHINA_PASS=max
# space logins ~1/min to avoid PAM rate limit
npm run audit && sleep 70 && npm run ui-audit
```
