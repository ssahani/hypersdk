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
| `POST /api/v1/zeus-security/hosts/{id}/tetragon/install` | Enroll Tetragon sensor |
| `POST /api/v1/zeus-security/k8s/{cluster_id}/tetragon/install` | Enroll Tetragon via Helm on cluster |
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

## UI routes

| Route | Page |
|-------|------|
| `/platform/zeus/security` | Security Center hub |
| `/platform/zeus/security/hunt` | Threat hunting workspace |
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
