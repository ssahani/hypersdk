# Live regression baselines

Rolling notes from deployed-host sweeps. Update as new loops complete.

## 2026-08-03 mission + catalog

| Suite | Result |
|-------|--------|
| `ops-mission.js` | **20/20 PASS** — browse disks, host FS, ConsoleHub, topology, fleet activity/mission/gpu, reports, observability, Atlas off, baremetal |
| `ui-mission.js` | **23/23 PASS** — mission-control, observability, activity, reports, GPU, topology, hubs, api-docs/ssh/disk-images/system-check |
| `ops-catalog.js` | **32/32 PASS** — jobs/audit/logs/templates/snapshots/backups, guest-health, guestkit 403, CD-ROM missing-ISO/device guards, **network ephemeral CRUD**, HA/webhooks/notifications, platform host+metrics |
| `ui-catalog.js` | **25/25 PASS** — jobs/audit/snapshots/backups/nwfilters/secrets/capabilities/events/logs/sessions/host-networking + platform HA/webhooks/notifications/hosts/storage/tasks/settings |

## 2026-08-03 fleet + K8s/OpenStack UI

| Suite | Result |
|-------|--------|
| `ops-fleet.js` | **15/15 PASS** — VM logs, devices (149), services (186), projects/users/apps/templates/tasks, AI agents + Zeus summary, OpenStack status (disabled), K8s contexts, **batch pause/resume** |
| `ui-k8s-os.js` | **22/22 PASS** — `/k8s*`, full OpenStack nav, applications/marketplace/enterprise/developer/support |

## Cumulative suites (same host)

| Suite | Result |
|-------|--------|
| `ops-infra.js` | 20/20 |
| `ops-platform.js` | 15/15 |
| `ops-lifecycle.js` | 11/11 |
| `ops-interactive.js` | 14/14 |
| `ui-security.js` | 15/15 |
| `ui-wizards.js` | 12/12 |
| `ui-settings.js` | 15/15 |
| `ui-interactive.js` | 11/11 |

```bash
export MACHINA_BASE_URL=https://212.8.248.187:5092
export MACHINA_USER=sus MACHINA_PASS=max
./chrome-launch.sh &
npm run mission && npm run catalog && npm run ui-mission && npm run ui-catalog
```
