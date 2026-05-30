# Zeus OS AI batches AI-332–351 — Multi-site federation

> Phase 24. Federated Zeus Firewall policy bundles across primary and DR sites.

## AI-332–335 — Federation + GitOps namespace

- Migration [`025_multisite_firewall.sql`](../controller/migrations/025_multisite_firewall.sql): `firewall_sites`, `firewall_site_policies`, drift + timeline tables
- Default sites: `primary-local`, `dr-replica` with `gitops_namespace` `site-primary` / `site-dr`
- `GET /api/v1/zeus-firewall/multisite/export` — federated policy bundle with namespaced policies

## AI-333–343 — DR templates + conflicts

- `GET /api/v1/zeus-firewall/multisite/dr-templates` — Primary/DR profile pairs with geo-fence stubs
- `GET /api/v1/zeus-firewall/multisite/overview` — site cards, compliance rollup, policy conflict detection

## AI-334–338 — Sync + lockdown

- `POST /api/v1/zeus-firewall/multisite/sync` — cross-site profile sync stub + optional replica lockdown

## AI-336–348 — Connectivity + drift

- `GET /api/v1/zeus-firewall/multisite/connectivity` — cross-site matrix with stretch deny heuristics
- `GET /api/v1/zeus-firewall/multisite/drift` — site pair drift compare snapshots

## AI-346–349 — Timeline + SIEM

- `GET /api/v1/zeus-firewall/multisite/timeline` — merged multi-site timeline
- Federated SIEM tag helper in [`multisite.rs`](../controller/src/engine/zeus_firewall/multisite.rs)

## UI (AI-337)

[`PlatformFirewallOverview.tsx`](../web/src/pages/platform/security/PlatformFirewallOverview.tsx) — Multi-site federation card with site roles and conflict hints.

## Spotlight (AI-345)

- `dr firewall`, `multi-site`, `multisite` → Zeus Firewall overview

## E2E (AI-341)

Section **ZEUS FIREWALL PHASE 24** in [`scripts/lib/e2e-platform-smoke.sh`](../scripts/lib/e2e-platform-smoke.sh).

## LLDP (host networking)

Physical topology hints via LLDP on the hypervisor host:

- `GET /api/v1/host/lldp` — neighbors from **systemd-networkd** (`networkctl lldp`) or **NetworkManager** (`nmcli device lldp list`)
- Host UI: **Host Networking → Systemd net diag** panel

## Out of scope

Live stretch-cluster routing, geo-DNS, or cross-controller federation control plane.
