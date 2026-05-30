# Zeus OS AI batches AI-172–371 (200 batches)

Phases 16–25 · Machina Zeus OS machine security evolution.


## Phase 16 — K8s write path (AI-172–191)

| Batch | Deliverable |
|-------|-------------|
| AI-172 | NetworkPolicy manifest compiler from Zeus profiles |
| AI-173 | CiliumNetworkPolicy manifest compiler |
| AI-174 | kubectl apply integration + apply log |
| AI-175 | K8s cluster readiness probe API |
| AI-176 | K8s plan/apply REST endpoints |
| AI-177 | K8s firewall UI page |
| AI-178 | GitOps policy operator reconcile tick |
| AI-179 | Profile → NP ingress rule mapping |
| AI-180 | K8s backend auto-detect (NP vs Cilium) |
| AI-181 | Phase 16 E2E smoke |
| AI-182 | NetworkPolicy rollback via checkpoint YAML |
| AI-183 | Namespace-scoped policy bundles |
| AI-184 | Zeus-managed-by labels on K8s objects |
| AI-185 | Dry-run manifest preview API |
| AI-186 | Controller migration 023 tables |
| AI-187 | K8s apply audit timeline events |
| AI-188 | Spotlight intent — k8s firewall |
| AI-189 | Zeus status backends list K8s |
| AI-190 | Multi-namespace plan batch (preview) |
| AI-191 | Phase 16 docs |

## Phase 17 — PacketWolf deep (AI-192–211)

| Batch | Deliverable |
|-------|-------------|
| AI-192 | Live anomalies REST bridge |
| AI-193 | Flow stats correlation in rule hints |
| AI-194 | PacketWolf anomalies API route |
| AI-195 | Activity enrichment with stats object |
| AI-196 | Process attribution placeholder API |
| AI-197 | AutoPolicy sync stub |
| AI-198 | Multi-cluster PacketWolf status |
| AI-199 | Blocked flow event normalization |
| AI-200 | Traffic-rule correlation UI hook |
| AI-201 | Anomalies E2E smoke |
| AI-202 | WebSocket activity stub |
| AI-203 | PacketWolf auth header passthrough |
| AI-204 | Dropped verdict flow filter |
| AI-205 | Target-scoped activity correlation |
| AI-206 | Incident link from anomaly id |
| AI-207 | Healer recommendation stub |
| AI-208 | PacketWolf capture on lockdown |
| AI-209 | Fleet activity aggregate card |
| AI-210 | Spotlight — packetwolf anomalies |
| AI-211 | Phase 17 docs |

## Phase 18 — Cloud edge (AI-212–231)

| Batch | Deliverable |
|-------|-------------|
| AI-212 | AWS security group read via aws CLI |
| AI-213 | Azure NSG list adapter |
| AI-214 | GCP firewall rules list adapter |
| AI-215 | Cloud open-port risk scoring |
| AI-216 | Cloud inventory snapshot table |
| AI-217 | Cloud overview API |
| AI-218 | Cloud SG UI page |
| AI-219 | Provider auto-detect chain |
| AI-220 | Public 0.0.0.0/0 critical port flags |
| AI-221 | Cloud E2E smoke |
| AI-222 | AWS rule detail expansion (preview) |
| AI-223 | Azure rule detail stub |
| AI-224 | GCP rule detail stub |
| AI-225 | Cloud + host unified overview strip |
| AI-226 | Cross-cloud summary in Zeus OS |
| AI-227 | Cloud drift snapshot compare |
| AI-228 | Export cloud inventory JSON |
| AI-229 | Spotlight — cloud security groups |
| AI-230 | FinOps cloud exposure tag stub |
| AI-231 | Phase 18 docs |

## Phase 19 — Guest in-guest (AI-232–251)

| Batch | Deliverable |
|-------|-------------|
| AI-232 | QEMU guest-agent ss port scan (core) |
| AI-233 | GetGuestFirewallPorts agent RPC |
| AI-234 | Controller VM guest-ports API |
| AI-235 | Guest port risk enrichment |
| AI-236 | Merge guest ports into exposure reports |
| AI-237 | Windows RDP/3389 guest detection |
| AI-238 | Guest agent unreachable messaging |
| AI-239 | In-guest vs host port diff stub |
| AI-240 | VM detail firewall guest strip (preview) |
| AI-241 | Guest ports E2E (soft) |
| AI-242 | Guest exec timeout handling |
| AI-243 | Multiple VM batch guest scan stub |
| AI-244 | Guest compliance report kind |
| AI-245 | Template guest-agent package default |
| AI-246 | Guest port timeline events |
| AI-247 | Spotlight — guest open ports |
| AI-248 | Linux ss parse hardening |
| AI-249 | macOS guest scan no-op |
| AI-250 | GuestTools install → rescan hook |
| AI-251 | Phase 19 docs |

## Phase 20 — Simulation GA (AI-252–271)

| Batch | Deliverable |
|-------|-------------|
| AI-252 | Connectivity matrix engine (core) |
| AI-253 | Profile-based after-rules simulation |
| AI-254 | Connectivity POST API |
| AI-255 | connectivity_runs persistence |
| AI-256 | Simulation integrated in AI simulate_plan |
| AI-257 | Connectivity matrix UI page |
| AI-258 | SSH/DB/internet probe defaults |
| AI-259 | Warning on internet→database allow |
| AI-260 | Matrix export JSON |
| AI-261 | Connectivity E2E smoke |
| AI-262 | Chaos firewall drill stub |
| AI-263 | Temporary rule simulation path |
| AI-264 | Multi-target fleet matrix stub |
| AI-265 | Simulation diff warnings merge |
| AI-266 | Rollback simulation note |
| AI-267 | Spotlight — connectivity test |
| AI-268 | Reports simulation CSV stub |
| AI-269 | Mission Control sim strip |
| AI-270 | Digital twin network + firewall |
| AI-271 | Phase 20 docs |

## Phase 21 — Enterprise (AI-272–291)

| Batch | Deliverable |
|-------|-------------|
| AI-272 | Firewall compliance PDF export |
| AI-273 | Approval SLA hours cluster setting |
| AI-274 | Stale approval auto-expire worker |
| AI-275 | SOC2 evidence JSON bundle stub |
| AI-276 | Compliance report machine detail |
| AI-277 | PDF Content-Disposition download |
| AI-278 | Approval SLA UI hint |
| AI-279 | Expired approval notifications |
| AI-280 | Audit log on approval review |
| AI-281 | Enterprise E2E PDF smoke |
| AI-282 | HIPAA firewall report kind |
| AI-283 | PCI segmentation report kind |
| AI-284 | CSV compliance export stub |
| AI-285 | Signed PDF stub |
| AI-286 | Approval delegation roles stub |
| AI-287 | Break-glass approval path stub |
| AI-288 | Compliance grade in Zeus summary |
| AI-289 | Spotlight — compliance PDF |
| AI-290 | Retention policy on timeline |
| AI-291 | Phase 21 docs |

## Phase 22 — FinOps × Security (AI-292–311)

| Batch | Deliverable |
|-------|-------------|
| AI-292 | Idle open port cost estimate stub |
| AI-293 | Exposure chargeback tag stub |
| AI-294 | Public port FinOps alert stub |
| AI-295 | Security waste in remediate hub |
| AI-296 | Cloud SG cost attribution stub |
| AI-297 | Fleet exposure cost rollup |
| AI-298 | Reports FinOps+firewall card |
| AI-299 | Budget guard firewall overlap |
| AI-300 | CSV exposure cost export stub |
| AI-301 | FinOps E2E stub |
| AI-302 | Per-team exposure attribution |
| AI-303 | VM idle port waste ranking |
| AI-304 | SRE + FinOps joint remediate |
| AI-305 | Spotlight — exposure cost |
| AI-306 | Chargeback firewall line items |
| AI-307 | Monthly exposure trend stub |
| AI-308 | GPU node exposure profile |
| AI-309 | Storage node exposure profile |
| AI-310 | Mission stack network cost |
| AI-311 | Phase 22 docs |

## Phase 23 — Bare metal + firewall (AI-312–331)

| Batch | Deliverable |
|-------|-------------|
| AI-312 | BMC VLAN profile stub |
| AI-313 | PXE net isolation profile |
| AI-314 | Bare metal host firewall target kind |
| AI-315 | IPMI exposure scan stub |
| AI-316 | Provisioning network deny-all stub |
| AI-317 | Bare metal + Zeus overview merge |
| AI-318 | Metal lockdown profile |
| AI-319 | PXE temporary allow rules |
| AI-320 | Metal compliance report kind |
| AI-321 | Metal E2E stub |
| AI-322 | Redfish network policy stub |
| AI-323 | BMC access temporary rule |
| AI-324 | Metal drift detection stub |
| AI-325 | Spotlight — bare metal firewall |
| AI-326 | Metal GitOps policy bundle |
| AI-327 | Metal SIEM export tag |
| AI-328 | Metal timeline events |
| AI-329 | Metal checkpoint stub |
| AI-330 | Metal agent inventory hook |
| AI-331 | Phase 23 docs |

## Phase 24 — Multi-site (AI-332–351)

| Batch | Deliverable |
|-------|-------------|
| AI-332 | Federated policy export stub |
| AI-333 | DR firewall template bundle |
| AI-334 | Cross-site profile sync stub |
| AI-335 | Site-scoped GitOps namespace |
| AI-336 | Stretch cluster deny rules stub |
| AI-337 | Multi-site overview card |
| AI-338 | Replica site lockdown sync |
| AI-339 | Federation PacketWolf stub |
| AI-340 | Site compliance rollup |
| AI-341 | Multi-site E2E stub |
| AI-342 | Policy conflict detection stub |
| AI-343 | Primary/DR profile pairs |
| AI-344 | Geo-fenced allow rules stub |
| AI-345 | Spotlight — DR firewall |
| AI-346 | Multi-site timeline merge |
| AI-347 | Site approval routing stub |
| AI-348 | Cross-site connectivity matrix |
| AI-349 | Federated SIEM export |
| AI-350 | Site drift compare |
| AI-351 | Phase 24 docs |

## Phase 25 — AI operator (AI-352–371)

| Batch | Deliverable |
|-------|-------------|
| AI-352 | Autonomous secure-machine preview |
| AI-353 | Guardrailed auto-apply stub |
| AI-354 | AI operator approval gate |
| AI-355 | Secure-plan execute enqueue stub |
| AI-356 | Risk score threshold config |
| AI-357 | Operator runbook firewall steps |
| AI-358 | Autopilot firewall batch stub |
| AI-359 | Mission Control operator strip |
| AI-360 | Spotlight — secure all hosts |
| AI-361 | Operator E2E stub |
| AI-362 | Explain + apply one-click |
| AI-363 | Rollback on operator failure |
| AI-364 | Operator audit trail |
| AI-365 | Fleet-wide secure plan API |
| AI-366 | Operator budget guard |
| AI-367 | Operator compliance pre-check |
| AI-368 | Operator PacketWolf verify |
| AI-369 | Operator multi-site stub |
| AI-370 | Operator docs + guardrails |
| AI-371 | Phase 25 E2E + docs |
