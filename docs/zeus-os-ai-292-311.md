# Zeus OS AI batches AI-292–311 — FinOps × Security

> Phase 22. Exposure cost estimation stubs tying Zeus Firewall inventory to FinOps reports, remediate hub, and budget guard.

## AI-292–294 — Port cost stubs

[`core/src/firewall/finops.rs`](../core/src/firewall/finops.rs):

- `idle_open_port_cost` — public idle listeners
- `port_monthly_cost` — risk-weighted monthly USD
- `public_port_finops_alert` — fleet alert string
- `exposure_chargeback_tag` — `chargeback:exposure:{team}:${usd}`

## AI-296–297 — Fleet rollup API

- `GET /api/v1/zeus-firewall/finops/exposure` — fleet exposure rollup
- `GET /api/v1/zeus-firewall/finops/exposure/export.csv` — CSV export (AI-300)

[`controller/src/engine/zeus_firewall/finops.rs`](../controller/src/engine/zeus_firewall/finops.rs) merges host + bare_metal targets, cloud SG attribution, GPU/storage multipliers, chargeback line items, and synthetic monthly trend (AI-307).

## AI-295 — Remediate hub

[`controller/src/engine/ai/exposure_finops.rs`](../controller/src/engine/ai/exposure_finops.rs) adds `finops` and `sre_finops` sources to [`remediate_hub.rs`](../controller/src/engine/ai/remediate_hub.rs).

## AI-299 — Budget guard overlap

[`cost_budget.rs`](../controller/src/engine/ai/cost_budget.rs) alerts when firewall exposure exceeds 5% of infra spend or idle port waste exceeds $50/mo.

## AI-302 — Per-team attribution

[`cost_attribution.rs`](../controller/src/engine/ai/cost_attribution.rs) adds `exposure_monthly_usd` per team bucket from firewall finops rollup.

## AI-303 — VM idle port ranking

Top 10 VMs by idle public port waste in exposure rollup `vm_idle_ranking`.

## AI-304 — SRE × FinOps joint remediate

`joint_sre_finops` pairs SRE forecast items with matching exposure waste on the same VM/host.

## AI-305 — Spotlight

- `exposure cost`, `firewall waste`, `port waste` → Reports + Zeus Firewall

## AI-306 — Chargeback line items

`chargeback_lines` in exposure report with `firewall_exposure` and `cloud_sg` categories.

## AI-308–310 — Profile / mission stack

- GPU/storage hostname or profile multipliers in `profile_exposure_multiplier`
- Mission stack adds `network_monthly_usd` via `mission_stack_network_cost`

## AI-311 — Zeus summary

`GET /api/v1/ai/zeus/summary` includes `exposure_waste_usd` highlight when material.

## UI

| Surface | Behavior |
|---------|----------|
| [`PlatformReports.tsx`](../web/src/pages/platform/PlatformReports.tsx) | FinOps × Zeus Firewall card with stats, VM ranking, CSV link |
| Remediate hub | FinOps waste + joint SRE items |

## E2E (AI-301)

Section **ZEUS FIREWALL PHASE 22** in [`scripts/lib/e2e-platform-smoke.sh`](../scripts/lib/e2e-platform-smoke.sh).

## Out of scope

Real cloud billing integration, packet-level metering, or automated port closure.
