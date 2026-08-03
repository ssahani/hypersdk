# Live regression baselines

Rolling notes from deployed-host sweeps. Update as new loops complete.

## 2026-08-03 guest/doctor + AI cost/capacity

| Item | Result |
|------|--------|
| `ops-guest.js` | **20/20 PASS** — domain-caps, pending-config, qemu-logs, viewer.vv, doctor/health-check, host linux/cockpit, Jarvis/cost/capacity |
| `ui-guest.js` | **12/12 PASS** — observability / reports / rightsizing / host+VM detail / system-check |

## 2026-08-03 network cross-layer + power NICs hard

| Item | Result |
|------|--------|
| `ops-power.js` | **11/11 PASS** — classic + platform pause/resume, disks, **hard** nics |
| `ui-power.js` | **10/10 PASS** — VM detail / consolehub / tasks / mission-control |
| `ops-net.js` | **19/19 PASS** — classic nic attach/detach ↔ platform nics, HA/SOC/events/templates/xml |
| `ui-net.js` | **10/10 PASS** — networks / HA / SOC / events / GPU / webhooks |
| **Controller** | `GET /api/v1/vms/{id}/nics` — **deployed** and verified live |

## Prior fixes (deployed)

- Platform disks live fallback for adopted VMs (`vda` verified)
- Login 429 retries + UI `tryLogin`

```bash
npm run guest && npm run ui-guest
npm run power && npm run ui-power && npm run net && npm run ui-net
```
