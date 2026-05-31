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
| `GET /api/v1/zeus-security/hosts/{id}/timeline` | Security flight recorder |
| `GET /api/v1/zeus-security/hosts/{id}/process-graph` | Process ancestry |
| `POST /api/v1/zeus-security/hosts/{id}/tetragon/install` | Enroll Tetragon sensor |
| `POST /api/v1/ai/security/explain-event` | AI event explanation |
| `POST /api/v1/ai/security/attack-reconstruct` | Attack chain from timeline |
| `POST /api/v1/ai/security/nl-search` | Natural language search |

OpenAPI: [`docs/openapi-packetwolf-fabric.json`](openapi-packetwolf-fabric.json)

## UI routes

| Route | Page |
|-------|------|
| `/platform/zeus/security` | Security Center hub |
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
