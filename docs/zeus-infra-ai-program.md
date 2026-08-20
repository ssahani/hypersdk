# Zyra Infrastructure AI Program (AI-138–147)

Autonomous Infrastructure Engineer capabilities for bare-metal + virtualization — deterministic-first, optional LLM enrichment.

## API surface

| Endpoint | Workstream | Purpose |
|----------|------------|---------|
| `GET /api/v1/ai/graph` | WS1 Graph Brain | Unified infrastructure graph |
| `POST /api/v1/ai/graph/path` | WS1 | VM-to-VM path + blockers |
| `POST /api/v1/ai/graph/query` | WS1 / AI-7 | NL infrastructure search |
| `GET /api/v1/ai/graph/object/{kind}/{id}` | WS6 Explain | Object summary + risks |
| `GET /api/v1/ai/graph/at/{timestamp}` | WS9 Time Machine | Point-in-time graph |
| `GET /api/v1/ai/timeline/replay` | WS9 | Audit/event replay scrubber |
| `GET/POST /api/v1/ai/incidents/analyze` | WS2 RCA | Root cause + evidence |
| `GET /api/v1/ai/memory/changes-before` | WS3 Memory | Pre-outage config delta |
| `POST /api/v1/ai/twin/simulate` | WS4 Digital Twin | Batch what-if scenarios |
| `POST /api/v1/ai/troubleshoot` | WS5 | VM slow/unreachable diagnosis |
| `GET /api/v1/ai/predictions` | WS7 | Unified failure predictions |
| `GET /api/v1/ai/rightsizing/report` | WS6 | FinOps recommendations |
| `GET /api/v1/ai/incidents/active` | WS8 Commander | Open incidents |
| `GET /api/v1/ai/incidents/{id}/room` | WS8 | War room bundle |
| `POST /api/v1/ai/nl-ops` | WS10 Ask Zyra | NL ops with dry-run default |

## UI map

| Route | Component |
|-------|-----------|
| `/platform/zyra` → Graph Brain tab | `MachinaInfraGraphBrain` |
| `/platform/zyra/rightsizing` | `PlatformRightsizing` |
| `/platform/zyra/incidents` | `PlatformIncidentCommander` |
| `/platform/topology` | `MachinaDigitalTwin` (what-if) |
| Mission Control | `MachinaInfrastructureTimeline` (RCA + evidence) |
| Dynamic Island | Top prediction from `/ai/predictions` |

## Data

- Migration `037_ai_infra_program.sql` — `ai_incidents` table
- `ai_memory_entries` wired via `memory_store::remember` on POST RCA
- Graph merges: twin + VM disks + spec_json NICs + app groups + backups + users

## E2E

- `web/e2e/zyra-infra-brain.spec.ts` — Graph Brain, rightsizing, incident commander

## Principles

1. All Tier-1 answers work without LLM (SQL + inventory + audit)
2. Mutations flow through approval queue (`ai_actions`) by default
3. NL ops default `dry_run: true` on `/ai/nl-ops`
