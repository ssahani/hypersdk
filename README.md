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
├── core/       Shared library — types, config, libvirt bindings, validation, XML helpers
├── daemon/     REST + WebSocket server (axum), VNC proxy, noVNC serving, Prometheus metrics
├── tui/        Terminal UI client (ratatui) with sidebar + content panel layout
├── web/        Web frontend (React 19 + TypeScript + Tailwind + Recharts + xterm.js)
├── contrib/    Systemd unit, default config
├── examples/   Example user configuration
└── scripts/    Install and demo scripts
```

---

## Features

### Web UI (http://localhost:8081)
- **Dashboard** — VM stats, host info, CPU/memory usage charts, VM list with state indicators
- **VM Management** — start, stop, shutdown, reboot, pause, resume, delete with confirmation dialogs
- **VM Details** — tabbed view (Overview, Disks, Network, Snapshots) with live metrics and autostart toggle
- **Create VM** — form with template selector (linux-small/medium/large, windows, minimal), validation
- **VNC Console** — in-browser VM display via noVNC, connected through daemon's WebSocket proxy — see the actual login screen, no external tools needed
- **Serial Console** — xterm.js terminal connected to VM's serial PTY via socat
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

### Infrastructure
- **WebSocket** — real-time VM state change notifications
- **VNC WebSocket proxy** — built-in TCP-to-WebSocket proxy for VNC, no external websockify needed
- **Serial console proxy** — WebSocket-to-PTY bridge via socat
- **noVNC serving** — auto-discovers system noVNC installation and serves at `/novnc/`
- **Connection resilience** — auto-reconnects to libvirt if connection drops
- **Systemd service** — hardened unit file with security restrictions
- **Config hierarchy** — user config > system config > defaults > CLI overrides
- **Input validation** — VM names, vCPU counts, memory, disk size bounds checked; XML-escaped user inputs
- **Graceful shutdown** — daemon handles SIGTERM/SIGINT cleanly

---

## Quick Start

### One-Line Install

```bash
curl -sSL https://raw.githubusercontent.com/ssahani/-virtspawn/main/scripts/install.sh | sudo bash
```

Or manually:

### Prerequisites

- Rust toolchain (1.70+)
- Node.js 18+ and npm (for web UI)
- `libvirt-devel` / `libvirt-dev` package
- `qemu-img` (for VM creation)
- `socat` (for serial console)
- `novnc` (for VNC console — optional, auto-detected)
- Running `libvirtd` service

```bash
# Fedora / RHEL / CentOS
sudo dnf install libvirt-devel qemu-img socat novnc
sudo systemctl enable --now libvirtd

# Debian / Ubuntu
sudo apt install libvirt-dev qemu-utils socat novnc
sudo systemctl enable --now libvirtd

# Arch Linux
sudo pacman -S libvirt qemu-base socat novnc
sudo systemctl enable --now libvirtd

# openSUSE
sudo zypper install libvirt-devel qemu-tools socat novnc
sudo systemctl enable --now libvirtd
```

### Build & Run

```bash
git clone https://github.com/ssahani/-virtspawn.git
cd virtspawn

# Build everything (daemon + TUI + web UI)
make release
make web

# Start the daemon
./target/release/virtspawn-daemon

# Open in browser
xdg-open http://localhost:8081

# Or use the TUI
./target/release/virtspawn-tui
```

### Install System-Wide

```bash
make release
make web
sudo make install
sudo systemctl enable --now virtspawn-daemon
```

This installs:
- `virtspawn-daemon` → `/usr/local/bin/virtspawn-daemon`
- `virtspawn` (TUI) → `/usr/local/bin/virtspawn`
- Web UI → `/usr/local/share/virtspawn/web/`
- Config → `/etc/virtspawn/config.toml`
- Systemd unit → `/usr/lib/systemd/system/virtspawn-daemon.service`

After install, open **http://localhost:8081** in your browser.

---

## Web UI Pages

| Page | URL | Description |
|------|-----|-------------|
| Dashboard | `/` | Stats cards, CPU/memory charts, VM list, host info |
| VM List | `/vms` | Table with search, state badges, lifecycle actions |
| VM Details | `/vms/{name}` | Tabbed view: Overview, Disks, Network, Snapshots |
| Create VM | `/create` | Template selector + form with validation |
| VNC Console | `/vms/{name}/console` | In-browser VNC display via noVNC |
| Serial Console | `/vms/{name}/console` | xterm.js terminal to VM serial port |
| Networks | `/networks` | Start/stop, autostart toggle, delete |
| Storage | `/storage` | Pool cards with usage bars, volume browser |
| Snapshots | `/snapshots` | List all, revert, delete |
| Host Info | `/node` | Hypervisor, CPU, memory, libvirt version |
| Live Metrics | `/events` | Real-time per-VM metrics table |

### Console Access

The VNC console connects directly through the daemon — no external websockify or noVNC server needed:

```
Browser → noVNC (served at /novnc/) → WebSocket (/ws/v1/vnc/{name}) → daemon TCP proxy → QEMU VNC
```

The serial console uses socat to connect to the VM's PTY:

```
Browser → xterm.js → WebSocket (/ws/v1/console/{name}) → socat → VM PTY (/dev/pts/X)
```

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
| `c` | Open virsh console |
| `e` | SSH to VM |
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
| `:vms` `:net` `:storage` `:snap` `:events` `:node` | Switch view |

---

## REST API

All endpoints are prefixed with `/api/v1`. Responses are JSON.

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
```

---

## Makefile Targets

```
make help       # Show all targets
```

| Target | Description |
|--------|-------------|
| `make release` | Build optimized Rust binaries |
| `make web` | Build web frontend (npm) |
| `make build` | Build in debug mode |
| `make test` | Run all Rust tests |
| `make lint` | Run clippy |
| `make fmt` | Format code |
| `sudo make install` | Install binaries, web UI, config, systemd unit |
| `sudo make uninstall` | Remove installed files |
| `make run-daemon` | Run daemon (debug) |
| `make run-tui` | Run TUI (debug) |
| `make clean` | Remove all build artifacts |

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

### Serial console disconnects immediately

```bash
which socat                                 # Is socat installed?
sudo dnf install socat                      # Install socat
virsh console <vm-name>                     # Does it work directly?
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
| Serial Console | [xterm.js](https://xtermjs.org) + socat |
| Libvirt | [virt](https://crates.io/crates/virt) crate |
| HTTP client | [Reqwest](https://crates.io/crates/reqwest) |
| Serialization | [Serde](https://serde.rs) |
| CLI | [Clap](https://clap.rs) |

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
