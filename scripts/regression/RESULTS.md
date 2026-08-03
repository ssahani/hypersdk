# Live regression baselines

Rolling notes from deployed-host sweeps. Update as new loops complete.

## 2026-08-03 platform power + NICs list

| Item | Result |
|------|--------|
| `ops-power.js` | **11/11 PASS** — classic + platform pause/resume (task wait), disks live, console |
| `ui-power.js` | **10/10 PASS** — VM detail / consolehub / tasks / mission-control |
| **Controller** | `GET /api/v1/vms/{id}/nics` — live libvirt NIC inventory (deploy pending in this note) |

## Prior fixes (deployed)

- Platform disks live fallback for adopted VMs (`vda` verified)
- Login 429 retries + UI `tryLogin`

```bash
npm run power && npm run ui-power
```
