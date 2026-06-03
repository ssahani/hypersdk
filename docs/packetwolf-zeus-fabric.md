# PacketWolf — Zeus Security Fabric

PacketWolf is the **eBPF-powered security and observability fabric** beneath Machina Zeus OS. It is not an optional monitoring plugin — it is the nervous system that powers Security Center, machine drill-down, firewall activity correlation, and AI security copilot features.

## Architecture

```text
Zeus Desktop / Web UI
        │
Machina Control Plane (/api/v1/zeus-security/*)
        │
PacketWolf Security Fabric (packetwolf/ service)
        │
Tetragon sensors (host + K8s)
        │
Linux kernel (eBPF)
```

**Machina owns:** orchestration, RBAC, UI, AI orchestration, Tetragon enrollment tasks.

**Machina SOC** (`/platform/soc`) correlates PacketWolf anomalies with firewall and audit events, runs detection rules, opens alerts, and exports to Splunk/Elastic/Sentinel/QRadar. See [`soc-integrations.md`](soc-integrations.md).

**PacketWolf owns:** event ingestion, normalization, ClickHouse hot storage, OpenSearch search, threat correlation, process graph.

## Deploy PacketWolf

```bash
cd packetwolf
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python run.py
# or: docker compose -f docker-compose.packetwolf.yml up -d
```

Configure controller (`examples/config.toml` or env):

```toml
[packetwolf]
enabled = true
base_url = "http://127.0.0.1:9091"
insecure_tls = true
```

## Machina API surface

| Route | Purpose |
|-------|---------|
| `GET /api/v1/zeus-security/status` | Fabric + firewall readiness |
| `GET /api/v1/zeus-security/fleet/threat` | Fleet threat score + critical feed |
| `GET /api/v1/zeus-security/graph` | Infrastructure security graph |
| `GET /api/v1/zeus-security/hosts/{id}/processes` | Process exec events |
| `GET /api/v1/zeus-security/hosts/{id}/connections` | Network events |
| `GET /api/v1/zeus-security/hosts/{id}/dns` | DNS queries |
| `GET /api/v1/zeus-security/hosts/{id}/files` | Sensitive file changes |
| `GET /api/v1/zeus-security/hosts/{id}/ports` | Open ports + process metadata |
| `GET /api/v1/zeus-security/hosts/{id}/containers` | K8s namespace/pod/container hierarchy |
| `GET /api/v1/zeus-security/hosts/{id}/timeline` | Security flight recorder |
| `GET /api/v1/zeus-security/hosts/{id}/process-graph` | Process ancestry |
| `GET /api/v1/zeus-security/hosts/{id}/fabric-status` | Live agent TracingPolicy + Tetragon service state |
| `POST /api/v1/zeus-security/hosts/{id}/tetragon/install` | Enroll Tetragon sensor |
| `POST /api/v1/zeus-security/k8s/{cluster_id}/tetragon/install` | Enroll Tetragon via Helm on cluster |
| `GET /api/v1/zeus-security/k8s/{cluster_id}/export-status` | PacketWolf export forwarder readiness |
| `GET /api/v1/zeus-security/fabric/health` | Fabric health — sensors, storage, hunt index |
| `GET /api/v1/zeus-security/hunt/queries` | Saved OpenSearch hunt playbooks |
| `POST /api/v1/zeus-security/hunt/run/{query_id}` | Run saved hunt query |
| `POST /api/v1/ai/security/explain-event` | AI event explanation |
| `POST /api/v1/ai/security/attack-reconstruct` | Attack chain from timeline |
| `POST /api/v1/ai/security/nl-search` | Natural language search |
| `GET /api/v1/zeus-security/fleet/timeline` | Unified fleet security timeline |
| `GET /api/v1/zeus-security/correlations` | Threat correlation findings |
| `POST /api/v1/zeus-security/alerts/sync` | Push critical alerts to notification outbox |

OpenAPI: [`docs/openapi-packetwolf-fabric.json`](openapi-packetwolf-fabric.json)

## Phase 3 — Correlation & threat hunting (PW-10–PW-12)

- **PacketWolf:** `correlator.py` (reverse shell, suspicious DNS, priv-esc chain, port scan); optional OpenSearch via `OPENSEARCH_URL`; fleet timeline + correlations API
- **Machina:** `/api/v1/zeus-security/fleet/timeline`, `/correlations`, `/alerts/sync`; incident analyze merges PacketWolf anomalies; SIEM export includes anomalies
- **UI:** Unified `SecurityTimelinePanel`, Threat Hunting workspace (`/platform/zeus/security/hunt`), Firewall Activity v2 (process + domain), PacketWolf card on Integrations hub

## Phase 4 — K8s enrichment (PW-13–PW-15)

- **PacketWolf:** K8s metadata on events; `GET /api/v1/hosts/{id}/containers` namespace → pod → container hierarchy
- **Machina:** `/api/v1/zeus-security/hosts/{id}/containers`; `POST /api/v1/zeus-security/k8s/{cluster_id}/tetragon/install` + `k8s.tetragon.install` task (Helm release scheduled)
- **UI:** Machine Security **Containers** tab with `ContainerHierarchyPanel`

## Phase 5 — AI security copilot (PW-16–PW-18)

When cluster AI is configured (Settings → AI provider + API key), security endpoints use the LLM with heuristic fallback:

| Endpoint | Behavior |
|----------|----------|
| `POST /api/v1/ai/security/explain-event` | LLM event explanation + risk |
| `POST /api/v1/ai/security/attack-reconstruct` | LLM attack chain from timeline |
| `POST /api/v1/ai/security/nl-search` | LLM query translation → PacketWolf search |
| `POST /api/v1/ai/security/hunt-summary` | Fleet hunt summary from correlations + timeline |

Responses include `llm_powered: true` when the model was used. Threat Hunting workspace surfaces AI summary, translated search hits, and attack reconstruction badges.

## Phase 6 — Runtime eBPF enforcement (PW-19–PW-21)

- **PacketWolf:** `enforcer.py` — deny process/DNS/port/IP policies, TracingPolicy generation, ingest-time verdict blocking
- **Machina:** `/api/v1/zeus-security/enforcement/*`, `host.enforcement.apply` task pushes TracingPolicy to agents
- **UI:** Runtime Enforcement (`/platform/zeus/security/enforcement`) — policy list, create, apply-to-host

## Phase 7 — Production hardening (PW-22–PW-24)

- **ClickHouse:** write-through on ingest, merged reads with in-memory cache (`clickhouse_store.py`); disable demo seed with `PACKETWOLF_DEMO=0`
- **Agent bundle:** `GET /api/v1/agents/{hostId}/bundle` — TracingPolicy YAML + pending Tetragon install for machina-agent pull
- **Machina:** `/api/v1/zeus-security/agents/{id}/bundle`; Tetragon install task queues agent bundle

## Phase 8 — Agent-side bundle apply (PW-25–PW-27)

- **machina-core:** `tetragon/apply.rs` writes TracingPolicy JSON to `/var/lib/machina/tetragon/tracing-policies/`, install stub script, and bundle manifest
- **machina-agent:** gRPC `ApplySecurityBundle`, `GetSecurityFabricStatus` (mirrors firewall `ApplyFirewallPlan` pattern)
- **Controller:** `packetwolf_sync` pulls bundle from PacketWolf during `host.inventory`, `host.tetragon.install`, and `host.enforcement.apply`; acks via `POST /api/v1/agents/{id}/bundle/ack`
- **Machina API:** `GET /api/v1/zeus-security/hosts/{id}/fabric-status` — live agent TracingPolicy inventory
- **UI:** Machine Security header shows applied policy count and Tetragon install state

## Phase 9 — Production Tetragon install (PW-28–PW-30)

- **Host install:** `core/tetragon/install.rs` — package manager or GitHub release download, `tetragon.service`, `tetragon-export.timer` forwarding JSONL export to `POST /api/v1/ingest/{hostId}`
- **Bundle apply:** `apply_security_bundle` runs install when `tetragon_install` is present in the agent bundle
- **K8s:** `packetwolf_k8s` runs `helm upgrade --install tetragon cilium/tetragon` from `k8s.tetragon.install` task
- **Fabric status:** `tetragon_service_active`, `tetragon_export_timer_active` on agent and Machine Security header
- **Env:** `MACHINA_TETRAGON_VERSION` (default `1.0.0`), `MACHINA_TETRAGON_DIR`, `MACHINA_TETRAGON_EXPORT_BATCH`

## Phase 10 — K8s export forwarder (PW-31–PW-33)

- **Manifests:** `contrib/k8s/packetwolf-export-forwarder.yaml` — Deployment tails Tetragon pod stdout and POSTs JSON batches to PacketWolf
- **Controller:** `packetwolf_k8s` applies forwarder after Helm install; `GET /api/v1/zeus-security/k8s/{cluster_id}/export-status`
- **Ingest host id:** `k8s-{clusterId}` matches cluster sensor registration
- **Requires:** `helm` + `kubectl` with cluster context on the controller (or bastion)

## Phase 11 — OpenSearch hunt + fabric health (PW-34–PW-36)

- **OpenSearch:** index bootstrap on startup (`ensure_index`), ping + document counts, merged search (OpenSearch + in-memory)
- **Hunt playbooks:** `GET /api/v1/hunt/queries`, `POST /api/v1/hunt/run/{id}` — six built-in SOC queries
- **Fabric health:** `GET /api/v1/fabric/health` — sensor staleness, storage reachability, hunt index stats
- **Machina:** `/api/v1/zeus-security/fabric/health`, `/hunt/queries`, `/hunt/run/{id}`; alert sync includes fabric issues
- **UI:** Threat Hunting saved queries + search backend badge; Security Center fabric health panel

## UI routes

| Route | Page |
|-------|------|
| `/platform/zeus/security` | Security Center hub |
| `/platform/zeus/security/hunt` | Threat hunting workspace |
| `/platform/zeus/security/enforcement` | Runtime eBPF enforcement |
| `/platform/zeus/machines/:hostId` | Machine security drill-down |
| `/platform/zeus/security/firewall` | Machine Security (firewall) |
| `/platform/zeus/security/activity` | Firewall activity (PacketWolf flows) |

## Tetragon enrollment

1. Operator clicks **Install Tetragon** on machine security view.
2. Controller enqueues `host.tetragon.install` task and registers sensor with PacketWolf.
3. Agent installs Tetragon binary/systemd unit (production path) or K8s Helm release on cluster bootstrap.
4. Tetragon export → PacketWolf ingest → ClickHouse + Security Center timeline.

## Testing

```bash
cd web && npm run build && npm run test:e2e -- e2e/zeus-security.spec.ts
```

Live: start PacketWolf on 9091, set `PACKETWOLF_ENABLED=1`, open Security Center.

## Related docs

- [`machina-zeus-os-vision.md`](machina-zeus-os-vision.md)
- [`platform-roadmap.md`](platform-roadmap.md) — Phase 18 PacketWolf fabric
- [`ux.md`](ux.md) — Security Center UX patterns
