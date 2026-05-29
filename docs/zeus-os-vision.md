# Zeus Platform — Vision (v1)

**Zeus** is the enterprise virtualization operating system. **Machina** is the hypervisor control product on Zeus — with **Machina AI** (Spotlight, Copilot, Doctor, Autopilot, and deterministic advisors; optional BYOK LLM) on top of Zyvor Platform and the Machina daemon UI.

**Status (main):** Batches **AI-49 through AI-87** are shipped. No AI-88+ batches are defined yet.

## Design principles

1. **Deterministic first** — scores, risk levels, and Fix actions work with `MACHINA_AI_DISABLED=1` or AI disabled in settings.
2. **LLM optional (BYOK)** — provider + encrypted API key in cluster settings; never returned on GET.
3. **Review → confirm → execute** — destructive mutations always show a review card before execution.
4. **Advisor / Autopilot modes** — Advisor recommends and explains; Autopilot preview confirms each fix; guarded batch Autopilot runs low-risk fixes on a schedule.

## v1 product map

| Feature | Description |
|---------|-------------|
| Machina Spotlight | ⌘Space unified command bar (⌘K alias) |
| Machina Copilot | Right-side assistant rail |
| Machina Doctor | VM health 0–100 + Fix actions |
| Migration Radar | VMware/HyperSDK readiness % |
| Cost Guardian | Idle/oversized/snapshot findings |
| Capacity Planner | Headroom + simple projections |
| Security Sentinel | Heuristic risk findings |
| Network Lens | Rule-based reachability explain |
| Runbook Generator | Incident → steps (+ LLM polish) |
| Blueprint Studio | NL → blueprint preview → deploy |

## API surface

- `GET/PATCH /api/v1/ai/settings`
- `POST /api/v1/ai/spotlight`, `/copilot/chat`, `/explain`, `/runbook`, `/blueprints/generate`
- `GET /api/v1/ai/cost`, `/capacity`, `/security`
- `POST /api/v1/ai/network/explain`
- `GET /api/v1/vms/{id}/doctor`
- `GET /api/v1/migrations/advisor`
- `GET /api/v1/ai/autopilot/propose`, `POST /api/v1/ai/autopilot/execute`
- `GET /api/v1/ai/compliance/export` — print-ready HTML (Save as PDF)
- `GET /api/v1/ai/compliance/export.pdf` — server-generated PDF
- `POST /api/v1/ai/copilot/stream` — SSE token streaming for Copilot
- `POST /api/v1/ai/autopilot/run`, `/terminal/suggest`
- `GET /api/v1/ai/autopilot/history`, `/api/v1/ai/cost/export.csv`, `/api/v1/ai/capacity/export.csv`
- `GET /api/v1/backups/timeline`

## Roadmap batches

See [`platform-roadmap.md`](platform-roadmap.md) batches AI-49 through AI-87 (all shipped).

## v2 batches (AI-57+)

| Batch | Deliverable |
|-------|-------------|
| AI-57 | Network Lens UI on Topology + Copilot reachability |
| AI-58 | Time Machine backup timeline (real cluster events) |
| AI-59 | AI Terminal Companion on console pages |
| AI-60 | Policy Generator YAML export |
| AI-61 | Navbar Copilot, VM context, docs + E2E |

## v3 batches (AI-62+)

| Batch | Deliverable |
|-------|-------------|
| AI-62 | Autopilot preview — propose/execute with audit |
| AI-63 | Compliance report + Markdown export |
| AI-64 | Time Machine restore on backup timeline |
| AI-65 | Terminal Companion v2 — guest key chips |
| AI-66 | Settings sync, E2E, docs |

## v4 batches (AI-67+)

| Batch | Deliverable |
|-------|-------------|
| AI-67 | Autopilot run — batch low-risk auto-fix with guardrails |
| AI-68 | Compliance HTML export (print-to-PDF) |
| AI-69 | Terminal suggest API + in-shell command chips |
| AI-70 | Autopilot dashboard card |
| AI-71 | Docs + E2E |

## v5 batches (AI-72+)

| Batch | Deliverable |
|-------|-------------|
| AI-72 | Copilot SSE streaming (`POST /api/v1/ai/copilot/stream`) |
| AI-73 | Server-side compliance PDF (`GET /api/v1/ai/compliance/export.pdf`) |
| AI-74 | Scheduled Autopilot leader worker + `ai_autopilot_interval_secs` |
| AI-75 | Settings interval UI, Copilot stream UX, Reports PDF download |
| AI-76 | Docs + E2E |

## v6 batches (AI-77+)

| Batch | Deliverable |
|-------|-------------|
| AI-77 | Autopilot history API (`GET /api/v1/ai/autopilot/history`) |
| AI-78 | Cost Guardian CFO CSV (`GET /api/v1/ai/cost/export.csv`) |
| AI-79 | Dashboard scheduled Autopilot status strip |
| AI-80 | Reports — history panel + CFO CSV download |
| AI-81 | Docs + E2E |

## v7 batches (AI-82+)

| Batch | Deliverable |
|-------|-------------|
| AI-82 | NL create VM Spotlight parsing + wizard prefill |
| AI-83 | Capacity Planner CSV export |
| AI-84 | Mission Control AI summary strip |
| AI-85 | Copilot quick-query chips |
| AI-86 | Reports capacity CSV download |
| AI-87 | Docs + E2E |
