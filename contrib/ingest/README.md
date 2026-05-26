# Machina metrics JSON ingest

`machina-metrics-ingest.py` is a minimal receiver for `[metrics_history].remote_write_url`.

```bash
python3 contrib/ingest/machina-metrics-ingest.py --port 9099
```

```toml
[metrics_history]
remote_write_url = "http://127.0.0.1:9099/ingest"
```

Each POST appends one JSON line (`MetricsHistoryPoint`). For production, use your own service or Grafana Alloy — see `contrib/alloy/README.md` for Prometheus/Mimir scrape.
