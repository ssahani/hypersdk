# Zeus OS AI batches AI-532–541 — Host Linux OS lift (Phase 33)

> Horizon phase 33. Lift hypervisor Linux observability into platform host System Settings; guest VM health/ports/services panes.

## AI-532–534 — Agent RPC

[`agent/proto/agent.proto`](../agent/proto/agent.proto):

- `GetLinuxObservability` — wraps `host_linux_obs::gather_linux_observability`
- `GetSystemdNetworkDiagnostics` — wraps `host_network::get_systemd_network_diagnostics`
- `GetLinuxAudit` — wraps `linux_audit::gather_linux_audit_configured`

## AI-535–537 — Controller APIs

[`controller/src/engine/host_os.rs`](../controller/src/engine/host_os.rs):

- `GET /api/v1/hosts/{id}/linux/observability`
- `GET /api/v1/hosts/{id}/linux/network-diag`
- `GET /api/v1/hosts/{id}/linux/audit`
- `GET /api/v1/vms/{id}/guest/health`
- `GET /api/v1/vms/{id}/guest/services`

## AI-538–540 — UI

[`PlatformHostDetail.tsx`](../web/src/pages/platform/PlatformHostDetail.tsx) — **MacSettingsPane**: General · Network · Linux · Security · Audit.

[`PlatformVmDetail.tsx`](../web/src/pages/platform/PlatformVmDetail.tsx) — **Guest Health · Guest Ports · Services** tabs.

## E2E

Section **HOST OS (AI-532–541)** in [`scripts/lib/e2e-platform-smoke.sh`](../scripts/lib/e2e-platform-smoke.sh).

## Out of scope

Kernel route mutation from platform UI, live guest systemd unit control — read-only v1.
