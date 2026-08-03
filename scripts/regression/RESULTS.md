# Live regression baselines

Rolling notes from deployed-host sweeps. Update as new loops complete.

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
```
