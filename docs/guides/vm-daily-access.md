# VM daily access (SSH, VNC, export, ports)

Operators use the **Daily access** panel on VM detail (platform and classic) for everyday tasks: graphical console, SSH, copy commands, guest ports, NAT exposure, and exports.

## Daily access panel

On **VM detail → Overview** (platform) or below the power toolbar (classic), the panel has four sections:

| Section | Actions |
|---------|---------|
| **Connect** | **VNC** — ConsoleHub / noVNC; **SSH** — in-browser terminal (hypervisor keys) |
| **Copy** | Guest IP; NAT-aware `ssh -p … user@hypervisor` when guest is on libvirt NAT; VNC deep link |
| **Ports** | Top guest listening ports (with guest tools); **Expose** chip creates hypervisor NAT; open laptop HTTP URLs |
| **Export** | Download spec JSON, domain XML, both, or copy spec to clipboard |

When the guest IP is on hypervisor NAT (e.g. `192.168.122.x`), a **Laptop access checklist** walks through: VM running → guest IP → expose SSH → copy laptop command.

### SSH from your laptop

- Machina does not store private keys.
- Cloud-init VMs are often **SSH-key only** — use the private key that matches the injected public key: `ssh -i ~/.ssh/id_ed25519 -p 2222 ubuntu@HYPERVISOR_IP`.
- The UI copies hypervisor host + NAT port automatically when a rule exists (default SSH preset: host `2222` → guest `22`).
- Private guest IPs are **not** reachable directly from your laptop — always connect via the hypervisor address and NAT port.

### In-browser SSH (ConsoleHub Shell)

- Uses the hypervisor daemon’s SSH keys, not your cloud-init key.
- When NAT is exposed, ConsoleHub dials `127.0.0.1:NAT_PORT` on the hypervisor.
- If login fails, expose SSH and connect from your laptop with your private key.

### VNC

- **Platform:** `/platform/vms/{id}/consolehub` — Machine Cockpit with Display / Serial / Shell lenses.
- **Classic:** `/vms/{name}/console` — same noVNC viewer.
- Linux cloud images often log in on **Serial** first; use ConsoleHub’s Serial lens or the recovery card when password login is not configured.

### Ports (platform)

Requires QEMU guest agent / Machina guest tools. Lists in-guest listeners via `GET /api/v1/zeus-firewall/vms/{id}/guest-ports`.

**NAT port forwarding** is managed on **VM detail → Network → Hypervisor NAT**, in ConsoleHub **Network** lens, and inline from scanned ports / guest-access banners.

Known presets include SSH (2222→22), HTTP (9080→80), HTTPS (9443→443), databases, Grafana, etc. Custom named services can be saved per VM (server-side templates).

## Platform Finder

In **Virtual Machines** column/list view, the inspector shows **VNC**, **SSH**, and **Copy IP** when a guest address is cached on the VM record.

## API reference

| Method | Path | Use |
|--------|------|-----|
| `GET` | `/api/v1/vms/{id}/console` | VNC WebSocket path |
| `GET` | `/api/v1/vms/{id}/consolehub/plan` | ConsoleHub plan incl. `guest_access`, `ssh_connect_host/port` |
| `GET` | `/api/v1/vms/{id}/guest/health` | Guest IP, tools status |
| `GET` | `/api/v1/zeus-firewall/vms/{id}/guest-ports` | Listening ports |
| `GET` | `/api/v1/vms/{id}/port-forwards` | Active NAT rules for guest IP |
| `POST` | `/api/v1/vms/{id}/port-forwards` | Create NAT rule |
| `GET/POST` | `/api/v1/vms/{id}/port-forward-templates` | Custom service templates |
| `GET` | `/api/v1/vms/{id}/spec` | VM spec JSON |
| `GET` | `/api/v1/vms/{id}/domain-xml` | Live libvirt XML |

List VMs may include `guest_ip` and `guest_tools_status` when synced from health checks.

## Automation

```bash
./scripts/e2e-vm-lifecycle-remote.sh user host --ssh-key ~/.ssh/id_ed25519
```

Verifies console API, guest ports, SSH login, and spec/XML export. Platform smoke tests cover NAT expose and ConsoleHub guest-access actions when VMs exist.

## See also

- [VM lifecycle and SSH keys](vm-lifecycle-ssh.md)
