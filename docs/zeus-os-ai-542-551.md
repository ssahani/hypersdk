# Zeus OS AI batches AI-542–551 — Host/VM diagnose + fix-it (Phase 34)

> Horizon phase 34. AI diagnosis and Fix It actions on host Linux panes and guest VM OS tabs.

## AI-542–544 — Diagnose APIs

[`controller/src/engine/host_os.rs`](../controller/src/engine/host_os.rs):

- `POST /api/v1/hosts/{id}/diagnose` — knowledge diagnose + linux-obs PSI signals + fix actions
- `POST /api/v1/vms/{id}/diagnose` — guest health context + knowledge diagnose + fix actions

## AI-545–547 — AI integration

- [`intent_router.rs`](../controller/src/engine/ai/intent_router.rs) — Spotlight: disk pressure, systemd network, guest ports, firewall drift
- [`context.rs`](../controller/src/engine/ai/context.rs) — Copilot host snapshot (IO PSI) via `host_id` on chat/stream body

## AI-548–550 — UI

- [`OsDiagnosePanel.tsx`](../web/src/components/platform/OsDiagnosePanel.tsx) — hypotheses + Fix It buttons
- [`PlatformHostDetail.tsx`](../web/src/pages/platform/PlatformHostDetail.tsx) — Copilot chip, diagnose on Linux/Security panes
- [`PlatformVmDetail.tsx`](../web/src/pages/platform/PlatformVmDetail.tsx) — diagnose on Guest Health/Services; Explain on guest ports

## E2E

Section **HOST OS AI (AI-542–551)** in [`scripts/lib/e2e-platform-smoke.sh`](../scripts/lib/e2e-platform-smoke.sh).
