# Zeus OS AI batches AI-312–331 — Bare metal + Zeus Firewall

> Phase 23. Bare-metal servers as `bare_metal` Zeus Firewall targets with synthetic BMC/PXE inventory and policy-only apply.

## AI-312–318 — Metal profiles

| Profile | Intent |
|---------|--------|
| `BareMetalBmc` | BMC VLAN — IPMI/Redfish from admin network |
| `BareMetalPxe` | PXE isolation — DHCP/TFTP/boot from provisioning net |
| `ProvisioningDenyAll` | Deny-all on provisioning segment |
| `MetalLockdown` | Emergency BMC-only management |
| `BareMetalRedfish` | Redfish HTTPS + restricted IPMI |

Defined in [`core/src/firewall/profiles.rs`](../core/src/firewall/profiles.rs).

## AI-314–317 — Target kind + overview merge

- Migration [`024_baremetal_firewall.sql`](../controller/migrations/024_baremetal_firewall.sql): `firewall_profile`, `firewall_enabled`, `bmc_vlan`, `pxe_vlan`, `posture_json`, `last_exposure_scan_at`
- [`controller/src/engine/zeus_firewall/inventory.rs`](../controller/src/engine/zeus_firewall/inventory.rs): merges `baremetal_servers` into fleet overview with `kind: bare_metal`
- `GET /api/v1/zeus-firewall/baremetal/overview` — metal-only slice
- `POST /api/v1/zeus-firewall/baremetal/{id}/scan` — IPMI/Redfish exposure scan stub

## AI-315–324 — Synthetic inventory + drift

[`core/src/firewall/metal.rs`](../core/src/firewall/metal.rs):

- `gather_metal_inventory` — synthetic ports 623/443 (BMC), 67/69/4011 (PXE)
- `scan_ipmi_exposure` — TCP probe + public BMC heuristics
- `compile_metal_plan` — policy-only diff (no live BMC ACL push)

Drift/checkpoint/timeline use `target_kind = bare_metal`.

## AI-319–323 — Temporary rules

- `POST /api/v1/zeus-firewall/baremetal/{id}/temporary` — presets `pxe` (1h) and `bmc` (4h)

## AI-326–327 — GitOps + SIEM

- On bare-metal register: upsert `firewall_policies` row `metal-{hostname}` (GitOps export)
- SIEM export tags `bare_metal` events with `detail.tag = metal`

## AI-320 — Compliance

- `GET /api/v1/zeus-firewall/compliance/metal` — filters `bare_metal` targets
- PDF export via existing compliance PDF handler

## AI-330 — Enroll hook

- `link_host_firewall_profile(baremetal_id, host_id)` copies profile note to host (policy stub until agent apply)

## AI-385 — Zeus summary

- `GET /api/v1/ai/zeus/summary` includes `baremetal_critical_count`

## UI

| Surface | Behavior |
|---------|----------|
| [`PlatformFirewallOverview.tsx`](../web/src/pages/platform/security/PlatformFirewallOverview.tsx) | Host / Bare metal filter pills; HardDrive icon for metal |
| [`PlatformFirewallTargetDetail.tsx`](../web/src/pages/platform/security/PlatformFirewallTargetDetail.tsx) | Policy-only banner; exposure scan + temporary BMC/PXE rules |
| [`PlatformZeusOs.tsx`](../web/src/pages/platform/PlatformZeusOs.tsx) | Register with VLAN/profile; `MacListRow` → Machine Security |

## Spotlight (AI-325)

- `bare metal firewall`, `BMC exposure`, `IPMI exposed` → firewall overview
- `PXE isolation` → Zeus OS bare metal tab

## E2E (AI-321)

Section **ZEUS FIREWALL PHASE 23** in [`scripts/lib/e2e-platform-smoke.sh`](../scripts/lib/e2e-platform-smoke.sh).

## Out of scope

Live IPMI/Redfish ACL enforcement, Metal³/Ironic, real PXE VLAN switching.
