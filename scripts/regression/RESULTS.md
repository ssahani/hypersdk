# Live regression baselines

Rolling notes from deployed-host sweeps. Update as new loops complete.

## 2026-08-03 host extras + secrets

| Suite | Result |
|-------|--------|
| `ops-host.js` | **34/34 PASS** — host stats/FS/PCI/USB/IOMMU/interfaces/virt, libvirt boot/memtune/cputune, send-key alt_tab, AI rightsizing + GPU placement, Zeus firewall, **secrets define/list/delete** |
| `ui-host.js` | **19/19 PASS** — node/devices/secrets, placement/maintenance/launchpad/applications, rightsizing/approvals/incidents/firewall |

## 2026-08-03 hardware + SOC/K8s

| Suite | Result |
|-------|--------|
| `ops-hardware.js` | **26/26 PASS** |
| `ui-hardware.js` | **18 PASS / 1 SOFT** |

## 2026-08-03 mission + catalog

| Suite | Result |
|-------|--------|
| `ops-mission.js` | **20/20 PASS** |
| `ui-mission.js` | **23/23 PASS** |
| `ops-catalog.js` | **32/32 PASS** |
| `ui-catalog.js` | **25/25 PASS** |

## Cumulative (same host)

ops-fleet 15 · ui-k8s-os 22 · ops-infra 20 · ops-platform 15 · ops-lifecycle 11 · ops-interactive 14 · ui-security/wizards/settings/interactive all green

```bash
export MACHINA_BASE_URL=https://212.8.248.187:5092
export MACHINA_USER=sus MACHINA_PASS=max
./chrome-launch.sh &
npm run host && npm run ui-host
```
