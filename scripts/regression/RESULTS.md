# Live regression baselines

Rolling notes from deployed-host sweeps. Update as new loops complete.

## 2026-08-03 enterprise / maintenance / network

| Item | Result |
|------|--------|
| `ops-enterprise.js` | **32/32 PASS** — maintenance schedules CRUD, fleet snapshot schedules CRUD, notification channels CRUD+test, host cordon on/off, cluster/leadership/settings/cert, enterprise MFA/vault/FIPS/tenants, network segments/IPAM/canvas, fleet DNA/finder/updates, SOC ASM, templates marketplace/missing, guestkit + linux updates |
| `ui-enterprise.js` | **10/10 PASS** — enterprise / maintenance / network-canvas / networks / hosts / HA / placement / templates / SOC / hosts/finder |

```bash
npm run enterprise && npm run ui-enterprise
```

## 2026-08-03 alerts / backups / SOC playbooks

| Item | Result |
|------|--------|
| `ops-alerts.js` | **24/24 PASS** — alert-rules CRUD, SOC playbooks CRUD+patch, playbook-runs, SOC rules/alert patch, notification deliver, backup targets+schedules CRUD, timeline / VM backups list / fleet backups / backup-SLA / showback / migrations / users |
| `ui-alerts.js` | **10/10 PASS** — notifications / backups / webhooks / SOC / audit / users / events / alert-rules / operations / observability |

```bash
npm run alerts && npm run ui-alerts
```

## 2026-08-03 planner / schedules / AI writes

| Item | Result |
|------|--------|
| `ops-planner.js` | **24/24 PASS** — VM schedule CRUD, scheduled-jobs CRUD, blueprints CRUD, AI generate/vm-builder/spotlight/explain/runbook/attack-path/services-impact/knowledge, host sync task, spice-absent negative, observability + SOC overview |
| `ui-planner.js` | **10/10 PASS** — blueprints / vm-builder / create-advanced / create / templates / observability / SOC / operations / maintenance / recommendations |

```bash
npm run planner && npm run ui-planner
```

## 2026-08-03 resize + spice→vnc fix

| Item | Result |
|------|--------|
| `ops-resize.js` | **17/17 PASS** — platform vCPU/memory resize tasks, host validate task, spice→vnc (portable), troubleshoot/nl-ops/twin simulate |
| `ui-resize.js` | **10/10 PASS** — create / vm-builder / templates / content / storage |
| **Fix** | `virt_xml_convert_spice_to_vnc` — fall back when virtinst lacks `--convert-to-vnc` (Ubuntu 4.x); no-op if already VNC |

## 2026-08-03 operations / developer hub

| Item | Result |
|------|--------|
| `ops-ops.js` | **29/29 PASS** |
| `ui-ops.js` | **10/10 PASS** |

## 2026-08-03 platform admin mutate

| Item | Result |
|------|--------|
| `ops-admin.js` / `ui-admin.js` | **17/17** / **10/10** |

## 2026-08-03 Zeus AI / parity / guest / net / power

| Suites | Result |
|--------|--------|
| `ops-ai` / `ui-ai` | **22/22** / **10/10** |
| `ops-parity` / `ui-parity` | **23/23** / **13/13** |
| `ops-guest` / `ui-guest` | **20/20** / **12/12** |
| `ops-net` / `ui-net` | **19/19** / **10/10** |
| `ops-power` / `ui-power` | **11/11** / **10/10** |

```bash
npm run resize && npm run ui-resize
npm run operations && npm run ui-operations
npm run planner && npm run ui-planner
npm run alerts && npm run ui-alerts
npm run enterprise && npm run ui-enterprise
```
