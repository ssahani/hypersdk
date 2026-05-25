# Fleet control plane

Machina can aggregate multiple hypervisor hosts from a single UI entry point.

## Configuration

```toml
[fleet]
enabled = true
primary_peer = "hv2"
standby_peer = "hv3"

[[fleet.peers]]
name = "hv2"
url = "https://hypervisor2.example.com:5092"
api_token = "<automation-token-from-remote-host>"
insecure_tls = false
```

- **Local host** — always included in `/api/v1/fleet/vms`.
- **Peers** — health via `/api/v1/fleet/status`; VM inventory merged on the Fleet page.
- **Lifecycle** — `POST /api/v1/fleet/peers/{name}/proxy` forwards `GET`/`POST`/`DELETE` to peer API paths (e.g. `/vms/{name}/start`).

Use API tokens on peers with least privilege (`operator` role recommended).

## Web UI

Open **Fleet** in the Core nav group for peer status and cross-host start/stop/shutdown.
