# PacketWolf — Zeus Security Fabric

eBPF-powered security and observability service for Machina Zeus OS.

## Quick start

```bash
cd packetwolf
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python run.py
```

API: http://127.0.0.1:9091/health

Configure Machina controller:

```toml
[packetwolf]
enabled = true
base_url = "http://127.0.0.1:9091"
insecure_tls = true
```

Or env: `PACKETWOLF_ENABLED=1`, `PACKETWOLF_BASE_URL=http://127.0.0.1:9091`

## Docker stack

```bash
docker compose -f docker-compose.packetwolf.yml up -d
```

Includes ClickHouse (schema in `schema/clickhouse.sql`) and OpenSearch for future indexing.

## Ingest Tetragon JSON

```bash
curl -X POST http://127.0.0.1:9091/api/v1/ingest/h1 \
  -H 'Content-Type: application/json' \
  -d '{"events":[{"process_exec":{"process":{"pid":99,"binary":"/usr/bin/curl"},"args":"example.com"}}]}'
```
