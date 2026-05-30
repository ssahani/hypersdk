# Zeus OS AI batches AI-572–581 — Fleet Activity Monitor (Phase 37)

> Horizon phase 37. macOS Activity Monitor metaphor extended fleet-wide — VMs plus hypervisor Linux PSI.

## AI-572–574 — Backend

[`controller/src/engine/fleet_activity.rs`](../controller/src/engine/fleet_activity.rs):

- `GET /api/v1/fleet/activity` — top running VMs by CPU + hosts with inventory metrics and Linux IO PSI/thermal

## AI-575–577 — UI

[`PlatformActivityMonitor.tsx`](../web/src/pages/platform/PlatformActivityMonitor.tsx):

- **VMs** tab — CPU/memory bars (from `vm_metrics`)
- **Hosts** tab — CPU, memory, IO PSI, thermal (from Phase 33 agent RPC when online)
- Menu bar **Activity** link in [`PlatformMenuBar.tsx`](../web/src/components/platform/PlatformMenuBar.tsx)

## Network Lens (topology)

[`MachinaNetworkLens.tsx`](../web/src/components/ai/MachinaNetworkLens.tsx) on [`PlatformTopology.tsx`](../web/src/pages/platform/PlatformTopology.tsx) — reachability explain via `POST /api/v1/ai/network/explain`.

## E2E / CLI

- Section in [`scripts/lib/e2e-platform-smoke.sh`](../scripts/lib/e2e-platform-smoke.sh) (FLEET DESKTOP block)
- `platformctl fleet activity`
