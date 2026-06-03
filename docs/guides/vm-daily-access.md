# VM daily access (SSH, VNC, export, ports)

Operators use the **Daily access** panel on VM detail (platform and classic) for everyday tasks: graphical console, SSH, copy commands, guest ports, and exports.

## Daily access panel

On **VM detail → Overview** (platform) or below the power toolbar (classic), the panel has four sections:

| Section | Actions |
|---------|---------|
| **Connect** | **VNC** — noVNC graphical console; **SSH** — in-browser terminal |
| **Copy** | Guest IP; `ssh user@ip` command; VNC deep link |
| **Ports** | Top guest listening ports (platform, with guest tools); copy `ip:port`; open HTTP URLs; link to NAT rules |
| **Export** | Download spec JSON, domain XML, both, or copy spec to clipboard |

### SSH

- Machina does not store private keys.
- Use the public key injected at create time (cloud-init) with your local private key: `ssh -i ~/.ssh/id_ed25519 user@guest-ip`.
- If guest IP is not ready, **SSH** opens a dialog to enter IP and user manually (saved per VM in the browser).

### VNC

- **Platform:** `/platform/vms/{id}/console` — proxied WebSocket to the host agent.
- **Classic:** `/vms/{name}/console` — same noVNC viewer.
- Use **Ctrl+Alt+Del** from the VNC toolbar when needed.

### Ports (platform)

Requires QEMU guest agent / Machina guest tools. Lists in-guest listeners via `GET /api/v1/zeus-firewall/vms/{id}/guest-ports`.

**NAT port forwarding** (expose host port → guest) is configured under **Host networking → Port forwarding** (`/host-networking?tab=portforward`). From a VM with a known guest IP, use **NAT rules** in the daily access panel to open the form pre-filled with that IP.

## Platform Finder

In **Virtual Machines** column/list view, the inspector shows **VNC**, **SSH**, and **Copy IP** when a guest address is cached on the VM record.

## API reference

| Method | Path | Use |
|--------|------|-----|
| `GET` | `/api/v1/vms/{id}/console` | VNC WebSocket path |
| `GET` | `/api/v1/vms/{id}/guest/health` | Guest IP, tools status |
| `GET` | `/api/v1/zeus-firewall/vms/{id}/guest-ports` | Listening ports |
| `GET` | `/api/v1/vms/{id}/spec` | VM spec JSON |
| `GET` | `/api/v1/vms/{id}/domain-xml` | Live libvirt XML |

List VMs may include `guest_ip` and `guest_tools_status` when synced from health checks.

## Automation

```bash
./scripts/e2e-vm-lifecycle-remote.sh user host --ssh-key ~/.ssh/id_ed25519
```

Verifies console API, guest ports, SSH login, and spec/XML export. Platform smoke tests cover the same endpoints when VMs exist.

## Follow-up (not in v1)

- Controller-scoped **NAT port-forward** CRUD on `/api/v1/vms/{id}/port-forwards` (daemon already supports host-level rules today).
- See also [VM lifecycle and SSH keys](vm-lifecycle-ssh.md).
