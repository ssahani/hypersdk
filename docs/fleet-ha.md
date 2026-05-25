# Fleet HA and multi-host operations

Machina fleet mode aggregates peer hypervisors from a single UI entry point.

## Configuration

```toml
[fleet]
enabled = true
primary_peer = "hv-east"
standby_peer = "hv-west"

[[fleet.peers]]
name = "hv-east"
url = "https://hv-east.example.com:5092"
api_token = "mach_…"

[[fleet.peers]]
name = "hv-west"
url = "https://hv-west.example.com:5092"
api_token = "mach_…"
```

- **primary_peer** — shown in the Fleet UI; prefer this peer for operator workflows.
- **standby_peer** — document DR/secondary; lifecycle proxy can target any peer by name.

## APIs

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/fleet/status` | Peer health + versions |
| `GET /api/v1/fleet/vms` | Merged VM list (local + peers) |
| `POST /api/v1/fleet/peers/{name}/proxy` | Forward API calls to a peer |

## HA pattern (active / standby)

1. Run **machina-daemon** on each hypervisor (`install.sh --bind 0.0.0.0 --open-firewall`).
2. Point DNS or a reverse proxy VIP at the **primary** host for operators.
3. Keep **standby** in `[fleet]` for inventory; fail over by updating DNS/proxy to the standby URL.
4. Optional: `contrib/systemd/machina-daemon-standby.service.example` for a passive unit that stays stopped until failover.

Full automatic leader election is not built in — use your load balancer or DNS for VIP failover.
