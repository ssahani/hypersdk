# virtspawn

**A modern libvirt VM management suite** — Rust daemon with REST/WebSocket API, a web UI with VNC console, and a keyboard-driven terminal UI.

Manage virtual machines, networks, storage, and snapshots from your browser or terminal. Full VNC console access, live metrics, and Prometheus integration — all through a single daemon.

---

## Architecture

```
  ┌─────────────────────┐   ┌──────────────────────┐
  │   virtspawn Web UI  │   │   virtspawn TUI      │
  │  (React + noVNC)    │   │  (ratatui terminal)  │
  └─────────┬───────────┘   └──────────┬───────────┘
            │                          │
            └────────┬─────────────────┘
                     │  HTTP / WebSocket
            ┌────────┴─────────────────┐
            │    virtspawn-daemon      │
            │  (axum REST API + noVNC  │
            │   + VNC/console proxy)   │
            └────────┬─────────────────┘
                     │  libvirt API
            ┌────────┴─────────────────┐
            │     QEMU / KVM          │
            │   Virtual Machines       │
            └──────────────────────────┘
```

### Workspace Layout

```
virtspawn/
├── core/               Shared library — types, config, libvirt bindings, validation, XML helpers
├── daemon/             REST + WebSocket server (axum), VNC proxy, noVNC serving, Prometheus metrics
├── tui/                Terminal UI client (ratatui) with sidebar + content panel layout
├── web/                Web frontend (React 19 + TypeScript + Tailwind + Recharts + xterm.js)
├── contrib/            Systemd unit, default config
├── demo-screenshots/   Screenshots, presentation PDFs, and PDF generators
├── examples/           Example user configuration
├── scripts/            Utility scripts (demo, status, backup, bulk operations)
├── install.sh          Automated installer (Fedora/Ubuntu)
└── Makefile            Build, install, deploy, manage targets
```

---

## Features

### Web UI (http://localhost:8081)
- **Dashboard** — VM stats, host info, CPU/memory usage charts, VM list with state indicators
- **VM Management** — start, stop, shutdown, reboot, pause, resume, delete with confirmation dialogs
- **VM Details** — tabbed view (Overview, Disks, Network, Snapshots) with live metrics and autostart toggle
- **Create VM** — form with template selector (linux-small/medium/large, windows, minimal), validation
- **VNC Console** — in-browser VM display via noVNC, connected through daemon's WebSocket proxy — see the actual login screen, no external tools needed
- **Serial Console** — xterm.js terminal connected directly to VM's serial PTY via async I/O
- **Networks** — list, start/stop, toggle autostart, delete
- **Storage** — pool cards with capacity bars, volume browser, delete volumes
- **Snapshots** — list all across VMs, revert, delete
- **Host Info** — hypervisor, CPU model/cores/threads, memory, libvirt version
- **Live Metrics** — real-time memory/disk/network I/O per VM
- **Toast notifications** — success/error/warning feedback for all actions
- **WebSocket live updates** — dashboard auto-refreshes when VM state changes
- **Responsive** — works on desktop and mobile with collapsible nav
- **Dark theme** — modern dark UI

### VM Management
- **Create** from parameters or templates with auto-generated qcow2 disk, VNC graphics, virtio devices, q35 machine type
- **Interactive creation dialog** — form-based VM creation with template dropdown, field validation, Tab navigation (`n` key)
- **Lifecycle** — start, stop (force), shutdown (graceful), reboot, pause, resume, delete with confirmation dialogs
- **Clone** with automatic UUID regeneration and unique MAC addresses
- **Resize** vCPUs and memory (applies on next boot)
- **Rename** VMs (requires shutoff state)
- **Autostart** toggle per VM, network, and storage pool
- **Disk management** — hot attach/detach disks to running or stopped VMs
- **Console access** — VNC in browser, virt-viewer, SSH, or virsh console

### Live Metrics & Monitoring
- **Memory usage** with Unicode block bar graphs (`▁▂▃▄▅▆▇█`)
- **Sparkline trends** — mini sparkline of last 20 metric readings per VM
- **CPU time**, disk I/O (read/write), network I/O (RX/TX)
- **Prometheus endpoint** (`/api/v1/prometheus`) for Grafana integration
- **State transition highlights** — rows flash when a VM changes state

### Snapshots, Networks, Storage
- **Snapshots** — list, create, delete, revert across all VMs
- **Networks** — create, delete, start, stop, toggle autostart for virtual networks (NAT with DHCP)
- **Storage** — browse pools with capacity/usage, start/stop/refresh pools, toggle autostart, volume browser

### TUI Experience
- **vSphere-style sidebar + content layout** — left inventory tree with collapsible categories
- **Sub-tabs per object** — Summary, Monitor, Configure tabs for VMs
- **Fuzzy search** — scored character-by-character matching
- **Multi-select** — batch operations on multiple VMs
- **Sorting** — by name, state, CPU, or memory
- **Command mode** — vim-style `:command` interface
- **Mouse support** — click, scroll, select
- **Audit trail** — persistent log at `~/.virtspawn/audit.log`

### Backup & Restore
- **Full or per-VM backup** — XML configs and optionally disk images
- **NFS backup target** — auto-mount NFS, backup, unmount
- **Incremental backup** — rsync with hardlinks for unchanged disk files
- **SHA-256 checksums** — generated after every backup, verifiable via API
- **Retention policy** — keep last N backups, auto-prune older ones
- **Download** — download any backup as tar.gz from the web UI
- **Scheduled backups** — systemd timer (daily 2 AM), enable/disable from web UI
- **Status tracking** — live progress percentage during backup
- **Restore** — redefine VMs, networks, storage pools, and optionally restore disk images
- **Per-VM backup button** — one-click backup from VM details page

### Infrastructure
- **WebSocket** — real-time VM state change notifications
- **VNC WebSocket proxy** — built-in TCP-to-WebSocket proxy for VNC, no external websockify needed
- **Serial console proxy** — direct async PTY I/O over WebSocket (no socat dependency)
- **noVNC serving** — auto-discovers system noVNC installation and serves at `/novnc/`
- **Connection resilience** — auto-reconnects to libvirt if connection drops
- **Systemd service** — hardened unit file with security restrictions
- **Config hierarchy** — user config > system config > defaults > CLI overrides
- **Input validation** — VM names, vCPU counts, memory, disk size bounds checked; XML-escaped user inputs
- **Security hardened** — migration URI validation (SSRF prevention), ISO path canonicalization, PTY path validation, integer overflow protection, no CORS (same-origin only)
- **Audit logging** — all operations logged with timestamps to `~/.virtspawn/audit.log`
- **Graceful shutdown** — daemon handles SIGTERM/SIGINT cleanly

---

## Quick Start

### Automated Install (recommended)

Single script that installs all dependencies, builds, and starts everything:

```bash
# From a fresh Fedora or Ubuntu machine:
git clone https://github.com/ssahani/-virtspawn.git
cd virtspawn
sudo ./install.sh
```

The installer:
- Detects your OS (Fedora/RHEL/Ubuntu/Debian)
- Installs system dependencies (libvirt, qemu-kvm, gcc, nodejs)
- Finds or installs Rust toolchain
- Builds release binaries + web frontend
- Installs and starts the systemd service
- Runs 15 verification tests

Options: `--uninstall`, `--deps-only`, `--no-start`

### Prerequisites (manual install)

- Rust toolchain (1.70+)
- Node.js 18+ and npm (for web UI)
- `libvirt-devel` / `libvirt-dev` package
- `qemu-img` (for VM creation)
- `novnc` (for VNC console — optional, auto-detected)
- Running `libvirtd` service

```bash
# Fedora / RHEL / CentOS
sudo dnf install libvirt-devel qemu-kvm qemu-img virt-install
sudo systemctl enable --now libvirtd

# Debian / Ubuntu
sudo apt install libvirt-dev qemu-kvm qemu-utils virtinst
sudo systemctl enable --now libvirtd
```

### Build & Deploy (recommended)

```bash
git clone https://github.com/ssahani/-virtspawn.git
cd virtspawn

# Build everything (Rust binaries + web frontend)
make

# Install and start the daemon
sudo make deploy
```

That's it. Open **http://localhost:8081** in your browser, or run `virtspawn` for the TUI.

### What `make deploy` does

1. Installs `virtspawn-daemon` → `/usr/local/bin/virtspawn-daemon`
2. Installs `virtspawn` (TUI) → `/usr/local/bin/virtspawn`
3. Installs web UI → `/usr/local/share/virtspawn/web/`
4. Installs config → `/etc/virtspawn/config.toml`
5. Installs systemd units → `virtspawn-daemon.service`, `virtspawn-backup.service`, `virtspawn-backup.timer`
6. Installs backup script → `/usr/local/share/virtspawn/scripts/backup.sh`
7. Installs backup config → `/etc/virtspawn/backup.conf`
8. Reloads systemd and starts the daemon

### Service Management

```bash
sudo make start     # start the daemon
sudo make stop      # stop the daemon
sudo make restart   # restart after changes
sudo make status    # check if running
sudo make uninstall # stop + remove everything
```

### Development Mode (no install)

```bash
make build                          # debug build
./target/debug/virtspawn-daemon     # run daemon
./target/debug/virtspawn-tui        # run TUI
cd web && npm run dev               # web UI dev server with hot reload (port 3000)
```

---

## Web UI Pages

| Page | URL | Description |
|------|-----|-------------|
| Dashboard | `/` | Stats cards, CPU/memory charts, VM list, host info |
| VM List | `/vms` | Table with search, state badges, lifecycle actions |
| VM Details | `/vms/{name}` | Overview (IPs, boot config), Disks, Network, Snapshots |
| Create VM | `/create` | Template selector + form with validation |
| VNC Console | `/vms/{name}/console` | In-browser VNC display via noVNC |
| Serial Console | `/vms/{name}/console` | xterm.js terminal to VM serial port |
| Networks | `/networks` | Start/stop, autostart toggle, delete |
| Storage | `/storage` | Pool cards with create/delete, volume browser with resize/clone |
| Snapshots | `/snapshots` | List all, revert, delete |
| Host Info | `/node` | Hypervisor, CPU, memory, libvirt version |
| Live Metrics | `/events` | Real-time per-VM metrics table |
| Capabilities | `/capabilities` | Hypervisor capabilities, guest types, SMBIOS sysinfo |
| Node Devices | `/devices` | PCI, USB, SCSI, network device inventory |
| Network Filters | `/nwfilters` | List/delete libvirt network filters |
| Backups | `/backups` | Backup/restore, download, verify, schedule timer, per-VM |

### Console Access

The VNC console connects directly through the daemon — no external websockify or noVNC server needed:

```
Browser → noVNC (served at /novnc/) → WebSocket (/ws/v1/vnc/{name}) → daemon TCP proxy → QEMU VNC
```

The serial console connects directly to the VM's PTY (no socat needed):

```
Browser → xterm.js → WebSocket (/ws/v1/console/{name}) → async PTY I/O → VM PTY (/dev/pts/X)
```

> **Note:** VMs must use VNC graphics (not SPICE) for the browser console to work. New VMs created through virtspawn use VNC by default. The serial console requires `console=ttyS0` in the guest OS kernel cmdline.

---

## Configuration

Config files are loaded in order of precedence:

1. CLI arguments (highest priority)
2. `~/.virtspawn/config.toml` (user config)
3. `/etc/virtspawn/config.toml` (system config)
4. Built-in defaults

```toml
[general]
refresh_interval_secs = 5    # TUI polling interval

[daemon]
host = "0.0.0.0"             # Bind address (all interfaces)
port = 8081                  # Bind port

[libvirt]
uri = "qemu:///system"       # Libvirt connection URI

[backup]
backup_dir = "/var/lib/virtspawn/backups"  # Where backups are stored
# nfs_target = "192.168.1.100:/backups"    # NFS target (optional)
with_disks = false                          # Include disk images by default
retain = 7                                  # Keep last 7 backups
```

See [`examples/config.toml`](examples/config.toml) for the full annotated configuration.

### CLI Options

**Daemon:**

```bash
virtspawn-daemon                                    # defaults
virtspawn-daemon --port 9090 --host 127.0.0.1        # localhost only
virtspawn-daemon --libvirt-uri qemu:///session       # user session
virtspawn-daemon --config /path/to/config.toml      # custom config
RUST_LOG=tower_http=debug virtspawn-daemon          # enable request tracing
```

**TUI:**

```bash
virtspawn                                           # defaults
virtspawn --url http://192.168.1.10:8081            # remote daemon
virtspawn --refresh 10                              # 10s refresh interval
virtspawn --config /path/to/config.toml             # custom config
```

---

## TUI Keyboard Reference

### Panel Navigation

| Key | Action |
|-----|--------|
| `h` / `←` | Focus sidebar panel |
| `l` / `→` | Focus content panel (`l` on a VM opens logs instead) |
| `j` / `↓` | Move down |
| `k` / `↑` | Move up |
| `g` / `G` | Jump to top / bottom |
| `PageUp` / `PageDown` | Jump 10 items |
| `Tab` / `BackTab` | Cycle sub-tabs (Summary, Monitor, Configure) |
| `1` / `2` / `3` | Jump to sub-tab directly |

### VM Actions

| Key | Action |
|-----|--------|
| `s` | Start |
| `x` | Stop (force) |
| `H` | Shutdown (graceful) |
| `b` | Reboot |
| `p` | Pause |
| `u` | Resume |
| `d` | Delete (modal confirmation) |
| `t` | Toggle autostart |
| `n` | New VM (interactive dialog) |
| `o` | Clone (shows command hint) |
| `y` | View raw XML |
| `l` | View VM logs |
| `v` | Launch virt-viewer |
| `V` | Open noVNC in browser |
| `c` | Open virsh console |
| `e` | SSH to VM |
| `Space` | Multi-select toggle |
| `A` | Select all VMs |
| `Ctrl+Space` | Context menu |
| `/` | Fuzzy search |
| `:` | Command mode |
| `?` | Help overlay |

### Commands

| Command | Action |
|---------|--------|
| `:create` | Open VM creation dialog |
| `:create <name>` | Create VM with defaults |
| `:template <tmpl> <name>` | Create from template |
| `:clone <source> <new>` | Clone a VM |
| `:snap <vm> <name>` | Create a snapshot |
| `:rename <old> <new>` | Rename a VM |
| `:resize <name> vcpus <n>` | Set vCPU count |
| `:resize <name> memory <mb>` | Set memory |
| `:netcreate <name>` | Create a NAT network |
| `:backups` | Browse backups |
| `:backup run` | Backup all VMs |
| `:backup run <vm>` | Backup single VM |
| `:backup restore <id>` | Restore from backup |
| `:backup delete <id>` | Delete a backup |
| `:vms` `:net` `:storage` `:snap` `:events` `:node` | Switch view |

---

## REST API

All endpoints are prefixed with `/api/v1`. Responses are JSON unless noted. XML endpoints (`/xml`, `/sysinfo`) return `Content-Type: text/xml`.

### VMs

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/vms` | List all VMs |
| `POST` | `/vms` | Create VM |
| `GET` | `/vms/{name}` | VM details |
| `DELETE` | `/vms/{name}` | Delete VM |
| `GET` | `/vms/{name}/xml` | Raw XML |
| `POST` | `/vms/{name}/start` | Start |
| `POST` | `/vms/{name}/stop` | Force stop |
| `POST` | `/vms/{name}/shutdown` | Graceful shutdown |
| `POST` | `/vms/{name}/reboot` | Reboot |
| `POST` | `/vms/{name}/pause` | Suspend |
| `POST` | `/vms/{name}/resume` | Resume |
| `POST` | `/vms/{name}/clone` | Clone |
| `POST` | `/vms/{name}/autostart/{enabled}` | Set autostart |
| `POST` | `/vms/{name}/vcpus/{count}` | Set vCPUs |
| `POST` | `/vms/{name}/memory/{mb}` | Set memory |
| `POST` | `/vms/{name}/rename` | Rename |
| `POST` | `/vms/{name}/disk/attach` | Attach disk |
| `POST` | `/vms/{name}/disk/detach/{target}` | Detach disk |
| `GET` | `/vms/console-info/{name}` | Console info |
| `GET` | `/vms/{name}/interfaces` | Guest IP addresses (DHCP/agent) |
| `GET` | `/vms/{name}/hostname` | Guest hostname |
| `POST` | `/vms/{name}/cdrom/insert` | Insert ISO (`{"iso_path": "...", "target": "sda"}`) |
| `POST` | `/vms/{name}/cdrom/eject/{target}` | Eject CD-ROM |
| `POST` | `/vms/{name}/managed-save` | Hibernate (managed save) |
| `DELETE` | `/vms/{name}/managed-save` | Remove saved state |
| `GET` | `/vms/{name}/managed-save/status` | Check if saved |
| `GET` | `/vms/{name}/boot` | Boot config (devices, firmware, UEFI) |
| `POST` | `/vms/{name}/boot` | Set boot order (`{"devices": ["hd", "cdrom"]}`) |
| `POST` | `/vms/{name}/migrate` | Migrate (`{"dest_uri": "...", "live": true}`) |
| `POST` | `/vms/{name}/balloon/{mb}` | Live memory balloon |

### Snapshots

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/snapshots` | All snapshots |
| `GET` | `/vms/{vm}/snapshots` | VM snapshots |
| `POST` | `/vms/{vm}/snapshots` | Create |
| `DELETE` | `/vms/{vm}/snapshots/{snap}` | Delete |
| `POST` | `/vms/{vm}/snapshots/{snap}/revert` | Revert |

### Networks

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/networks` | List |
| `POST` | `/networks` | Create |
| `DELETE` | `/networks/{name}` | Delete |
| `POST` | `/networks/{name}/start` | Start |
| `POST` | `/networks/{name}/stop` | Stop |
| `GET` | `/networks/{name}/xml` | XML |
| `POST` | `/networks/{name}/autostart/{enabled}` | Autostart |

### Storage

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/storage/pools` | List pools |
| `POST` | `/storage/pools/{name}/start` | Start pool |
| `POST` | `/storage/pools/{name}/stop` | Stop pool |
| `POST` | `/storage/pools/{name}/refresh` | Refresh |
| `POST` | `/storage/pools/{name}/autostart/{enabled}` | Autostart |
| `GET` | `/storage/pools/{pool}/volumes` | List volumes |
| `POST` | `/storage/pools/{pool}/volumes` | Create volume |
| `DELETE` | `/storage/pools/{pool}/volumes/{vol}` | Delete volume |
| `POST` | `/storage/pools` | Create pool (`{"name": "...", "pool_type": "dir", "target_path": "/path"}`) |
| `DELETE` | `/storage/pools/{name}` | Delete pool |
| `GET` | `/storage/pools/{name}/xml` | Pool XML |
| `POST` | `/storage/pools/{pool}/volumes/{vol}/resize` | Resize (`{"capacity_gb": 20}`) |
| `POST` | `/storage/pools/{pool}/volumes/{vol}/clone` | Clone (`{"new_name": "..."}`) |

### Backups

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/backups` | List all backups with status, size, checksums |
| `POST` | `/backups` | Trigger backup (`{"vm_name":"...", "with_disks":true, "incremental":true, "retain":7}`) |
| `GET` | `/backups/{id}/status` | Live backup progress and status |
| `POST` | `/backups/{id}/verify` | Verify SHA-256 checksums |
| `GET` | `/backups/{id}/download` | Download backup as tar.gz |
| `POST` | `/backups/restore` | Restore from backup (`{"backup_id":"..."}`) |
| `DELETE` | `/backups/{id}` | Delete a backup |
| `GET` | `/backups/schedule` | Get systemd timer status |
| `POST` | `/backups/schedule` | Enable/disable timer (`{"enabled":true}`) |

### Host & Infrastructure

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/capabilities` | Hypervisor capabilities (arch, CPU, guest types) |
| `GET` | `/sysinfo` | SMBIOS system info XML |
| `GET` | `/devices` | List all node devices (`?capability=pci\|net\|usb`) |
| `GET` | `/devices/{name}` | Device XML |
| `GET` | `/nwfilters` | List network filters |
| `GET` | `/nwfilters/{name}` | Filter XML |
| `DELETE` | `/nwfilters/{name}` | Delete filter |
| `GET` | `/secrets` | List libvirt secrets |
| `DELETE` | `/secrets/{uuid}` | Delete secret |

### WebSocket

| Path | Description |
|------|-------------|
| `/ws/v1/watch` | Real-time VM state changes |
| `/ws/v1/console/{name}` | Serial console (PTY bridge) |
| `/ws/v1/vnc/{name}` | VNC display proxy |

### Other

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/node` | Host info |
| `GET` | `/templates` | VM templates |
| `GET` | `/prometheus` | Prometheus metrics |
| `GET` | `/health` | Health check |

### API Examples

```bash
# List VMs
curl -s http://localhost:8081/api/v1/vms | jq

# Create a VM
curl -s -X POST http://localhost:8081/api/v1/vms \
  -H 'Content-Type: application/json' \
  -d '{"name": "test-vm", "vcpus": 2, "memory_mb": 2048, "disk_gb": 20}' | jq

# Start a VM
curl -s -X POST http://localhost:8081/api/v1/vms/test-vm/start | jq

# Get VM metrics
curl -s http://localhost:8081/api/v1/metrics/test-vm | jq

# Create a snapshot
curl -s -X POST http://localhost:8081/api/v1/vms/test-vm/snapshots \
  -H 'Content-Type: application/json' \
  -d '{"name": "snap1", "description": "test snapshot"}' | jq

# Clone a VM
curl -s -X POST http://localhost:8081/api/v1/vms/test-vm/clone \
  -H 'Content-Type: application/json' \
  -d '{"new_name": "test-vm-clone"}' | jq

# Host info
curl -s http://localhost:8081/api/v1/node | jq

# Prometheus metrics
curl -s http://localhost:8081/api/v1/prometheus

# Trigger a backup (all VMs)
curl -s -X POST http://localhost:8081/api/v1/backups \
  -H 'Content-Type: application/json' \
  -d '{"retain": 7}' | jq

# Backup a single VM with disks
curl -s -X POST http://localhost:8081/api/v1/backups \
  -H 'Content-Type: application/json' \
  -d '{"vm_name": "test-vm", "with_disks": true}' | jq

# List backups
curl -s http://localhost:8081/api/v1/backups | jq

# Verify backup checksums
curl -s -X POST http://localhost:8081/api/v1/backups/20260324-020000/verify | jq

# Download backup as tar.gz
curl -sO http://localhost:8081/api/v1/backups/20260324-020000/download

# Restore from backup
curl -s -X POST http://localhost:8081/api/v1/backups/restore \
  -H 'Content-Type: application/json' \
  -d '{"backup_id": "20260324-020000"}' | jq

# Enable scheduled backups
curl -s -X POST http://localhost:8081/api/v1/backups/schedule \
  -H 'Content-Type: application/json' \
  -d '{"enabled": true}' | jq
```

---

## Makefile Targets

```
make help       # Show all targets
```

| Target | Description |
|--------|-------------|
| `make` | Build everything (Rust release + web frontend) |
| `sudo make deploy` | Install and start daemon (one command) |
| `sudo make start` | Start the daemon service |
| `sudo make stop` | Stop the daemon service |
| `sudo make restart` | Restart the daemon service |
| `sudo make status` | Show daemon service status |
| `sudo make install` | Install binaries, web UI, config, systemd unit |
| `sudo make uninstall` | Stop, disable, and remove everything |
| `make release` | Build optimized Rust binaries only |
| `make web` | Build web frontend only |
| `make build` | Build in debug mode |
| `make test` | Run all Rust tests |
| `make lint` | Run clippy |
| `make fmt` | Format code |
| `make run-daemon` | Run daemon in debug mode |
| `make run-tui` | Run TUI in debug mode |
| `make clean` | Remove all build artifacts |

### Typical Workflows

```bash
# First time setup
make && sudo make deploy

# After code changes
make && sudo make restart

# Full cleanup
sudo make uninstall && make clean
```

---

## Systemd Service

```bash
sudo make install
sudo systemctl enable --now virtspawn-daemon
sudo systemctl status virtspawn-daemon
sudo journalctl -u virtspawn-daemon -f
```

Security hardening: `ProtectSystem=strict`, `NoNewPrivileges=true`, `PrivateTmp=true`, `ProtectKernelTunables/Modules/Logs=true`, `RestrictAddressFamilies`, `SystemCallArchitectures=native`.

---

## Troubleshooting

### Daemon won't start

```bash
sudo systemctl status libvirtd              # Is libvirtd running?
virsh -c qemu:///system list --all          # Can you connect?
journalctl -u virtspawn-daemon -e           # Check logs
RUST_LOG=debug virtspawn-daemon             # Debug logging
```

### Web UI shows blank page

```bash
ls /usr/local/share/virtspawn/web/index.html   # Is web UI installed?
make web && sudo make install                   # Rebuild and reinstall
```

### VNC console won't connect

```bash
virsh vncdisplay <vm-name>                  # Is VNC port assigned?
curl -s http://localhost:8081/api/v1/vms/console-info/<vm-name> | jq   # Check port
# VNC only works on running VMs with graphics configured
```

### Serial console shows "Connected" but nothing appears

The guest OS needs serial console enabled in its kernel cmdline:
```bash
# Inside the VM, add to /etc/default/grub:
GRUB_CMDLINE_LINUX="console=ttyS0,115200"
# Then: sudo grub2-mkconfig -o /boot/grub2/grub.cfg && reboot
```

### VNC shows "Not Available"

The VM uses SPICE graphics instead of VNC. Switch to VNC:
```bash
sudo virsh edit <vm-name>
# Change: <graphics type='spice' ...>
# To:     <graphics type='vnc' port='-1' autoport='yes' listen='127.0.0.1'/>
# Restart the VM
```

### Permission denied

```bash
sudo usermod -aG libvirt $USER && newgrp libvirt
# Or: virtspawn-daemon --libvirt-uri qemu:///session
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Language | [Rust](https://www.rust-lang.org/) |
| Daemon | [Axum](https://github.com/tokio-rs/axum) + [Tokio](https://tokio.rs) |
| Terminal UI | [Ratatui](https://ratatui.rs) |
| Web UI | [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org/) + [Tailwind CSS 4](https://tailwindcss.com) |
| Charts | [Recharts](https://recharts.org) |
| VNC Console | [noVNC](https://novnc.com) (served from system install) |
| Serial Console | [xterm.js](https://xtermjs.org) + direct PTY I/O |
| Libvirt | [virt](https://crates.io/crates/virt) crate |
| HTTP client | [Reqwest](https://crates.io/crates/reqwest) |
| Serialization | [Serde](https://serde.rs) |
| CLI | [Clap](https://clap.rs) |

---

## Utility Scripts

### Status Overview

```bash
./scripts/status.sh
```

Single-screen dashboard showing host info, all VMs with state/vCPUs/memory, live metrics (memory %, disk I/O, network I/O), networks, storage pools with usage bars, snapshots, and service status.

### Backup & Restore

```bash
./scripts/backup.sh                          # Backup all VM/network/pool XML configs
./scripts/backup.sh --vm myvm               # Backup a single VM
./scripts/backup.sh --with-disks            # Also copy disk images
./scripts/backup.sh --incremental           # Incremental: hardlink unchanged disk files
./scripts/backup.sh --nfs 192.168.1.10:/bk  # Backup to NFS share
./scripts/backup.sh --retain 7             # Keep only last 7 backups
./scripts/backup.sh --list                  # Preview what would be backed up
./scripts/backup.sh --restore /var/lib/virtspawn/backups/20260323-123456
./scripts/backup.sh --verify /var/lib/virtspawn/backups/20260323-123456
```

Backups are saved to `/var/lib/virtspawn/backups/<timestamp>/` with VM/network/pool XML, JSON summaries, SHA-256 checksums, and optionally disk images. Use `--restore` to redefine VMs, networks, and storage pools (and optionally copy disk images back).

**Scheduled backups** via systemd timer:
```bash
sudo systemctl enable --now virtspawn-backup.timer   # Daily at 2 AM
sudo systemctl list-timers virtspawn-backup           # Check schedule
journalctl -u virtspawn-backup.service                # View logs
```

**Config file:** `/etc/virtspawn/backup.conf` — set backup_dir, nfs_target, retention, etc.

### Bulk Operations

```bash
./scripts/bulk.sh status                     # Quick VM status table
./scripts/bulk.sh start                      # Start all stopped VMs
./scripts/bulk.sh shutdown                   # Graceful shutdown all running VMs
./scripts/bulk.sh stop                       # Force stop all running VMs
./scripts/bulk.sh pause                      # Pause all running VMs
./scripts/bulk.sh resume                     # Resume all paused VMs
./scripts/bulk.sh snapshot                   # Auto-timestamped snapshot of all running VMs
./scripts/bulk.sh snapshot-clean             # Delete all auto-* snapshots
./scripts/bulk.sh start vm1 vm2              # Target specific VMs
```

### API Demo

```bash
sudo ./scripts/demo.sh                      # 30-step API demo (creates/tests/deletes a VM)
```

Exercises all 30+ API endpoints including VM lifecycle, snapshots, networks, storage, capabilities, devices, network filters, Prometheus metrics, and security validation tests.

---

## Documentation

PDF documentation is available in `demo-screenshots/`:

| Document | Description |
|----------|-------------|
| [virtspawn-demo.pdf](demo-screenshots/virtspawn-demo.pdf) | Client presentation — features, architecture, 10 live screenshots, security |
| [virtspawn-quickstart.pdf](demo-screenshots/virtspawn-quickstart.pdf) | Quick Start Guide — prerequisites, build, install, access, TUI shortcuts, config, troubleshooting |
| [virtspawn-api-reference.pdf](demo-screenshots/virtspawn-api-reference.pdf) | Complete API reference — all 30+ endpoints, curl examples, response formats, automation scripts |
| [virtspawn-security-architecture.pdf](demo-screenshots/virtspawn-security-architecture.pdf) | Security & Architecture — system diagram, input validation, SSRF prevention, comparison table |
| [virtspawn-demo-scripts-guide.pdf](demo-screenshots/virtspawn-demo-scripts-guide.pdf) | Demo & Scripts Guide — 30-step demo walkthrough, status/backup/bulk scripts reference |

Regenerate PDFs:
```bash
python3 demo-screenshots/generate_pdf.py              # demo deck
python3 demo-screenshots/generate_quickstart_pdf.py    # quickstart guide
python3 demo-screenshots/generate_api_pdf.py           # API reference
python3 demo-screenshots/generate_security_pdf.py      # security & architecture
python3 demo-screenshots/generate_demo_guide_pdf.py    # demo & scripts guide
```

---

## Contributing

```bash
git clone https://github.com/ssahani/-virtspawn.git
cd virtspawn
make build && make test && make lint && make fmt-check
```

---

## License

MIT
