# Live regression baselines

Rolling notes from deployed-host sweeps. Update as new loops complete.

## 2026-08-03 disk attach + login harden + platform disks fix

| Item | Result |
|------|--------|
| `ops-disk.js` | **11/11 PASS** — volume resize/clone, disk attach/detach with XML verify; `GET …/disks` still empty until controller deploy of live fallback |
| Login harden | `lib/api.js` retries on 429; UI suites use `tryLogin`; `loginBrowser` reuses session + retries |
| **Controller fix** | `list_vm_disks` falls back to live libvirt disks when `vm_disks` table empty (adopted VMs) |

## Prior waves

ops-volume 22 · ui-volume 15 · ops-audit 23 · ops-zeus 32 · ops-storage 23 · ops-host 34

```bash
npm run disk
# after controller deploy: platform-disks should be count>=1 for chrome-e2e-vm
```
