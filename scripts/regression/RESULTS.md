# Live regression baselines

Rolling notes from deployed-host sweeps. Update as new loops complete.


## 2026-08-04 graphx (AI graph/diagnose + Zeus approval gates)

| Item | Result |
|------|--------|
| `ops-graphx.js` | **21/21 PASS** — AI graph + object vm/host, fleet diagnose + schema negative, actions schema/reject negatives, memory delete schema, domain-xml, pending-config, Zeus approvals + approve/reject/baremetal scan/temporary negatives, storage volumes + tier/volume-delete negatives, fleet finder query, launchpad catalog soft |
| `ui-graphx.js` | **10/10 PASS** — zeus / approvals / incidents / security / hunt / enforcement / firewall / topology / hosts/finder / ai-providers |

```bash
npm run graphx && npm run ui-graphx
```

## 2026-08-04 eventx (events/tasks/audit filters + deliver)

| Item | Result |
|------|--------|
| `ops-eventx.js` | **26/26 PASS** — events kind/vm filters, tasks operation/failed/get + missing 404, audit action/resource_type, notifications kind+deliver, webhook deliveries + retry negative, api-keys schema, zeus timeline/enforcement/compliance, AI routing rules, MFA policies, SOC integrations + test negative, storage activate/deactivate negatives, network segments + graphics schema negatives, guestkit job soft 503 |
| `ui-eventx.js` | **10/10 PASS** — events / tasks / notifications / webhooks / activity / api-keys / soc / marketplace / users / content |

```bash
npm run eventx && npm run ui-eventx
```

## 2026-08-04 devhub (developer / operations / templates / policy)

| Item | Result |
|------|--------|
| `ops-devhub.js` | **32/32 PASS** — health/ready, developer/openapi/terraform/support/install.sh, cluster+settings+leadership, operations overview/runbooks/executions, templates+marketplace+missing-images, storage-tiers/backup-sla, policy rules/quotas/export, segments gitops, topology+network-canvas, task cancel/retry negatives, AI network-explain/runbook/spotlight/explain + schema negative |
| `ui-devhub.js` | **10/10 PASS** — developer / support / operations / templates / policy / storage-tiers / topology / ha / projects / enterprise |

```bash
npm run devhub && npm run ui-devhub
```

## 2026-08-04 healthx (doctor / diagnose / guest expected fails)

| Item | Result |
|------|--------|
| `ops-healthx.js` | **20/20 PASS** — VM doctor/diagnose/health-check, guest health/services, sync-time/fstrim agent-down expected, host detail/gpus/health-check, AI troubleshoot/nl-ops/predictions/sre/autopilot-propose, cloud-init invalid, OpenStack status + flavors negative, secrets schema negative |
| `ui-healthx.js` | **10/10 PASS** — VM/host detail / support / recommendations / observability / incidents / activity / events / upgrade / cloud-init |

```bash
npm run healthx && npm run ui-healthx
```

## 2026-08-04 vmx + aifleet

| Item | Result |
|------|--------|
| `ops-vmx.js` | **14/14 PASS** — metrics/timeline/topology/migrations/console/ws-token/guest-ips/pending-config batch, migrate precheck schema+same-host, migrate POST skipped (enqueues task), migrations list, advisor query negative |
| `ui-vmx.js` | **10/10 PASS** — VM detail / console / migration / topology / vms / tasks / activity / hosts / datacenter / network-canvas |
| `ops-aifleet.js` | **13/13 PASS** — zeus summary/security/agents, cost+attribution/capacity, services graph, memory incidents, copilot chat + schema negative, knowledge search, terminal suggest |
| `ui-aifleet.js` | **10/10 PASS** — zeus / configure / security / rightsizing / approvals / incidents / ai-providers / recommendations / reports / observability |

```bash
npm run vmx && npm run ui-vmx
npm run aifleet && npm run ui-aifleet
```

## 2026-08-04 fleet hubs + live discover (fleetx)

| Item | Result |
|------|--------|
| `ops-fleetx.js` | **21/21 PASS** — fleet general/shortcuts/users/network/storage/console/updates/spaces/dna/mission/linux-health/finder/keychain, storage+networks live/discover, AI fleet summary/local, launchpad unavailable soft |
| `ui-fleetx.js` | **10/10 PASS** — finder / datacenter / storage / networks / network-canvas / fleet-snapshots / gpu / activity / topology / launchpad |

```bash
npm run fleetx && npm run ui-fleetx
```

## 2026-08-04 gap queue (atlas → authz)

| Item | Result |
|------|--------|
| `ops-atlas` / `ui-atlas` | **14/14** / **10/10** — Atlas disabled soft-pass + schema negatives |
| `ops-guestkit` / `ui-guestkit` | **7/7** / **10/10** — status + nbd/worker expected failures + schema negatives |
| `ops-batch` / `ui-batch` | **7/7** / **10/10** — batch power/snapshots/delete schema + missing-VM only |
| `ops-aiops` / `ui-aiops` | **10/10** / **10/10** — jarvis/heatmap/mission/intent/rebalance dry (no execute) |
| `ops-watchdog` / `ui-watchdog` | **8/8** / **10/10** — watchdog get/set; disk/export POST skipped (starts real task) |
| `ops-linuxhost` / `ui-linuxhost` | **9/9** / **10/10** — linux updates/diag/obs; live host upgrade skipped |
| `ops-firewallx` / `ui-firewallx` | **14/14** / **10/10** — score/drift/simulate/siem + lockdown dry-run gate |
| `ops-authz` / `ui-authz` | **9/9** / **10/10** — OIDC/MFA upsert/cert/enroll/api-key rotate |
| `page-sweep --loops 1` | **130/130 PASS** (0 soft) |

```bash
npm run atlas && npm run ui-atlas
npm run guestkit && npm run ui-guestkit
npm run batch && npm run ui-batch
npm run aiops && npm run ui-aiops
npm run watchdog && npm run ui-watchdog
npm run linuxhost && npm run ui-linuxhost
npm run firewallx && npm run ui-firewallx
npm run authz && npm run ui-authz
```

## 2026-08-04 atlas storage (disabled-host)

| Item | Result |
|------|--------|
| `ops-atlas.js` | **14/14 PASS** — status (enabled=false), backends/clusters/pools/policies/metrics/snapshots/jobs soft-pass `atlas_disabled`, VM volumes [], expand/restore schema 422, backup/snapshot disabled |
| `ui-atlas.js` | **10/10 PASS** — storage-atlas / storage / storage-tiers / backups / fleet-snapshots / content / templates / vms / hosts / integrations |

```bash
npm run atlas && npm run ui-atlas
```

## 2026-08-04 hunt / security / firewall lockdown gate

| Item | Result |
|------|--------|
| `ops-hunt.js` | **24/24 PASS** — AI guest-query/hunt-summary/nl-search/attack-reconstruct, HA, snapshot list (create skipped: external overlays unsafe on running e2e VM), firewall plan/execute-batch dry-run, lockdown dry-run+confirm gate, zeus-security host extras, segment IPAM + emergency-unlock |
| `ui-hunt.js` | **10/10 PASS** — hunt / activity / firewall / policies / ports / services / HA / VM detail / network-canvas |
| **Fix** | Zeus `POST …/lockdown` now defaults `dry_run: true` and requires `{dry_run:false, confirm:true}` to apply Emergency Isolation (empty POST previously applied and locked the host) |
| **Recovery** | `scripts/recovery/unlock-emergency-isolation.sh` — Ubuntu/UFW + iptables (no firewalld) |

```bash
npm run hunt && npm run ui-hunt
```

## 2026-08-04 hub / network / webhooks / users / ops overview

| Item | Result |
|------|--------|
| `ops-hub.js` | **25/25 PASS** — network create/deactivate/activate/delete, webhook toggle roundtrip, template get + approval patch, user create/patch/delete, HA status, cluster leadership/settings, operations overview/showback, IPAM pools, AI cost budget/routing/memory/actions hub, scheduled jobs, notifications, cloud-init validate, install.sh, Zeus k8s export-status, task cancel/retry negatives |
| `ui-hub.js` | **10/10 PASS** — infrastructure / workloads / administration / resources / operations / datacenter / HA / cloud-init / users / webhooks |

```bash
npm run hub && npm run ui-hub
```

## 2026-08-04 providers / prompts / content / blueprints (+ content delete)

| Item | Result |
|------|--------|
| `ops-providers.js` | **34/34 PASS** — AI provider create/models/test-negative/patch/delete, prompt CRUD, blueprint create/get/run/delete, content create/approve/reject/delete, SOC rules patch/test, firewall approvals + k8s plan, fleet activity, placement refresh, storage tiers, topology, tasks/events, atlas disabled, enrollment tokens |
| `ui-providers.js` | **10/10 PASS** — ai-providers / blueprints / content / placement / topology / activity / enroll / storage-tiers / integrations / vm-builder |
| **Fix** | `DELETE /api/v1/content/images/{id}` — approve/reject existed without delete; leftover `reg-img*` rows could not be cleaned |

```bash
npm run providers && npm run ui-providers
```

## 2026-08-04 provision / join / IaC export (+ empty-spec export fix)

| Item | Result |
|------|--------|
| `ops-provision.js` | **31/31 PASS** — host detail/validate/cockpit, package-upgrade dry-run, cockpit invoke negatives, OIDC status/login-disabled, hosts join negative, webhook purge, spectator validate, guestkit status + schema negatives, templates marketplace/readiness, from-template/iso/virt-install schema + ISO path negative, VM spec/ws-token/adopt/prune/migrate schema, IaC export JSON+zip, network get, maintenance exit, postcheck |
| `ui-provision.js` | **10/10 PASS** — migration / templates / content / launchpad / developer / VM detail / hosts / networks / create-iso / create-advanced |
| **Fix** | IaC `GET /api/v1/vms/{id}/export[.zip]` failed with `missing field api_version` when `spec_json` was empty/`{}` (libvirt-synced VMs); now falls back to columnar vcpus/memory/project |

```bash
npm run provision && npm run ui-provision
```

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
npm run provision && npm run ui-provision
npm run providers && npm run ui-providers
npm run hub && npm run ui-hub
```
