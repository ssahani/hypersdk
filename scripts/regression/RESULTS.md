# Live regression baselines

Rolling notes from deployed-host sweeps. Update as new loops complete.


## 2026-08-04 security fabric / multisite / Zeus AI

| Item | Result |
|------|--------|
| `ops-security.js` | **52/52 PASS** — zeus-security status/sensors/graph/inventory/correlations/fabric/fleet threat, host fabric endpoints, enforcement sync/attach mode notes, alerts sync/search/ingest, multisite overview/connectivity/drift/timeline/DR/export/sync, operator thresholds/plan/dry-run, temporary rule, gitops export/sync, finops CSV + CIS PDF, fleet keychain/spaces, AI enterprise/zeus plan/chat/copilot/terminal/intent/network, hosts sync-all, prune-missing, vmware sync |
| `ui-fabric.js` | **10/10 PASS** — zeus security / hunt / enforcement / machines / k8s / cloud / connectivity / firewall / configure / approvals |

```bash
npm run security && npm run ui-fabric
```

## 2026-08-03 obs / compliance / consolehub / reports

| Item | Result |
|------|--------|
| `ops-obs.js` | **41/41 PASS** — observability SLOs/traces, prometheus, capacity/finops, AI compliance/frameworks/export/remediate, incidents analyze/ack/room, marketplace agents install/uninstall, remediate hub, rightsizing/GPU placement, migration readiness+advisor, CSV exports, API key rotate, upgrade matrix, SOC integrations (+ test negative), MFA/FIPS/tenants, fleet GPU/console, host GPUs/linux observability, baremetal, cloud-init validate, kubevirt sync, ConsoleHub plan/explain/access-approve/break-glass/collaborate/end |
| `ui-obs.js` | **10/10 PASS** — observability / reports / upgrade / api-keys / GPU / baremetal / zeus incidents / compliance / approvals / enterprise |

```bash
npm run obs && npm run ui-obs
```

## 2026-08-03 diag / developer / air-gap (+ bundle delete fix)

| Item | Result |
|------|--------|
| `ops-diag.js` | **26/26 PASS** — users/me + prune, VM/host diagnose + health-check, libvirt-details, cockpit.storage/network/system, SOC/cluster/AI settings patches, developer/support/openapi, cpu-compat/content/MFA, air-gap create/get/list/delete, publish-template roundtrip |
| `ui-diag.js` | **10/10 PASS** — developer / support / users / enterprise / hosts / host detail / VM detail / settings / HA / SOC |
| **Fix** | `DELETE /api/v1/enterprise/air-gap/bundles/{id}` — create/list existed without delete; leftover `reg-ag-*` bundles could not be cleaned |

```bash
npm run diag && npm run ui-diag
```

## 2026-08-03 policy / templates / marketplace

| Item | Result |
|------|--------|
| `ops-policy.js` | **26/26 PASS** — templates seed + sync-git negative, storage pool get/volumes/refresh/snapshot-policy, network gitops/IPAM, fence events, maintenance-mission, marketplace plugins + hypersdk install/uninstall, policy rules/quotas, recommendations, rightsizing/cost/budget/routing/memory, vault sync, port-forward guest-IP negative |
| `ui-policy.js` | **10/10 PASS** — templates / marketplace / recommendations / policy / storage / content / enterprise / rightsizing / network-canvas / maintenance |

```bash
npm run policy && npm run ui-policy
```

## 2026-08-03 apps / fleet desktop / SOC ops (+ application delete fix)

| Item | Result |
|------|--------|
| `ops-apps.js` | **28/28 PASS** — application group CRUD (+ start action), fleet desktop hubs, operations runbook execute, SOC ingest/forward, AI firewall explain/secure-plan, autopilot propose, baremetal capacity, segment connectivity, host cockpit, proxmox sync, air-gap bundles |
| `ui-apps.js` | **10/10 PASS** — applications / operations / baremetal / fleet-snapshots / network-canvas / SOC / zeus / approvals / enterprise / hosts |
| **Fix** | `DELETE /api/v1/applications/{id}` — create existed without delete; leftover `reg-app*` groups could not be cleaned |

```bash
npm run apps && npm run ui-apps
```

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
npm run apps && npm run ui-apps
npm run policy && npm run ui-policy
npm run diag && npm run ui-diag
npm run obs && npm run ui-obs
npm run security && npm run ui-fabric
```
