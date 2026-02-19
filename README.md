# virtspawn

A libvirt VM manager with a Rust daemon backend (REST + WebSocket API) and a ratatui TUI client.

## Architecture

```
virtspawn/
├── virtspawn-core/       Shared library (types, config, libvirt operations)
├── virtspawn-daemon/     REST + WebSocket server (axum)
└── virtspawn-tui/        Terminal UI client (ratatui)
```

The daemon talks to libvirt and exposes a versioned REST API. The TUI connects to the daemon and provides keyboard-driven VM management.

## Features

- **VM lifecycle**: start, stop (force), shutdown (graceful), reboot, pause, resume, delete, autostart
- **VM cloning**: clone VMs with automatic new UUID and MAC address generation
- **VM details**: vCPUs, memory, OS type, architecture, network interfaces, disks, UUID
- **VM metrics**: live memory usage percentage with color-coded thresholds, CPU time tracking
- **Snapshots**: list, create, delete, revert across all VMs
- **Networks**: list, start, stop virtual networks
- **Storage**: list pools with capacity/usage, list volumes
- **Node info**: hostname, hypervisor version, CPU model/cores/threads, memory, VM counts
- **Multi-select**: select multiple VMs and batch start/stop/reboot/pause/resume/delete
- **Audit trail**: tracks all operations with timestamps and results in an Events view
- **Context menu**: quick-access action overlay for the selected resource
- **Console access**: launch `virt-viewer` for graphical console directly from TUI
- **TUI**: 6 resource views, search/filter, sort, help screen, details panel, command mode

## Prerequisites

- Rust toolchain (1.70+)
- `libvirt-devel` / `libvirt-dev` package
- Running `libvirtd` service

```bash
# Fedora/RHEL
sudo dnf install libvirt-devel

# Debian/Ubuntu
sudo apt install libvirt-dev

sudo systemctl start libvirtd
```

## Build

```bash
cargo build --workspace
```

## Usage

Start the daemon:

```bash
cargo run -p virtspawn-daemon
```

In another terminal, start the TUI:

```bash
cargo run -p virtspawn-tui
```

## Configuration

Config file: `~/.virtspawn/config.toml`

```toml
[general]
refresh_interval_secs = 5

[daemon]
host = "127.0.0.1"
port = 8081

[libvirt]
uri = "qemu:///system"
```

An example config is provided in `examples/config.toml`.

## TUI Keyboard Shortcuts

### Navigation

| Key | Action |
|-----|--------|
| `j` / `Down` | Move down |
| `k` / `Up` | Move up |
| `g` | Go to top |
| `G` | Go to bottom |
| `Tab` / `Shift+Tab` | Next / previous view |
| `1`-`6` | Switch to view (VMs, Networks, Storage, Snapshots, Events, Node) |

### VM Actions

| Key | Action |
|-----|--------|
| `s` | Start |
| `x` | Stop (force) |
| `H` | Shutdown (graceful) |
| `b` | Reboot |
| `p` | Pause |
| `u` | Resume |
| `d` | Delete (with confirmation) |
| `o` | Clone (shows command hint) |
| `Enter` | Show details (with metrics, interfaces, disks) |
| `v` | Launch virt-viewer |
| `c` | Console hint |

### Multi-select (VMs view)

| Key | Action |
|-----|--------|
| `Space` | Toggle selection on current VM |
| `A` | Select all VMs |
| `Esc` | Clear selection |

When VMs are selected, actions (`s`, `x`, `H`, `b`, `p`, `u`, `d`) apply to all selected VMs as a batch operation.

### Network Actions

| Key | Action |
|-----|--------|
| `a` | Start network |
| `z` | Stop network |

### Snapshot Actions

| Key | Action |
|-----|--------|
| `R` | Revert to snapshot |
| `d` | Delete snapshot |

### Other Actions

| Key | Action |
|-----|--------|
| `/` | Search / filter |
| `:` | Command mode |
| `r` | Refresh |
| `?` / `F1` | Help screen |
| `Ctrl+Space` | Context menu |
| `N` / `S` / `C` / `M` | Sort by name / state / CPU / memory |
| `q` / `Esc` | Quit / close |

### Commands

| Command | Action |
|---------|--------|
| `:vms` | Switch to VMs view |
| `:net` | Switch to Networks view |
| `:storage` | Switch to Storage view |
| `:snap` | Switch to Snapshots view |
| `:events` | Switch to Events view |
| `:node` | Switch to Node view |
| `:snap <vm> <name>` | Create a snapshot |
| `:clone <source> <new-name>` | Clone a VM |
| `:quit` | Quit |

## REST API

All endpoints are under `/api/v1/`.

### VMs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/vms` | List all VMs |
| GET | `/vms/{name}` | VM details (interfaces, disks, OS info) |
| DELETE | `/vms/{name}` | Delete VM |
| GET | `/vms/{name}/xml` | Raw XML definition |
| POST | `/vms/{name}/start` | Start |
| POST | `/vms/{name}/stop` | Force stop |
| POST | `/vms/{name}/shutdown` | Graceful shutdown |
| POST | `/vms/{name}/reboot` | Reboot |
| POST | `/vms/{name}/pause` | Pause |
| POST | `/vms/{name}/resume` | Resume |
| POST | `/vms/{name}/clone` | Clone VM (body: `{"new_name": "..."}`) |
| POST | `/vms/{name}/autostart/{bool}` | Set autostart |

### Metrics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/metrics` | Metrics for all running VMs |
| GET | `/metrics/{name}` | Metrics for a single VM |

Returns CPU time (nanoseconds), vCPU count, memory total/used (MB), and memory usage percentage.

### Snapshots

| Method | Path | Description |
|--------|------|-------------|
| GET | `/snapshots` | List all snapshots |
| GET | `/vms/{vm}/snapshots` | List VM snapshots |
| POST | `/vms/{vm}/snapshots` | Create snapshot (body: `{"name": "...", "description": "..."}`) |
| DELETE | `/vms/{vm}/snapshots/{snap}` | Delete snapshot |
| POST | `/vms/{vm}/snapshots/{snap}/revert` | Revert to snapshot |

### Networks

| Method | Path | Description |
|--------|------|-------------|
| GET | `/networks` | List networks |
| POST | `/networks/{name}/start` | Start network |
| POST | `/networks/{name}/stop` | Stop network |
| GET | `/networks/{name}/xml` | Network XML |

### Storage

| Method | Path | Description |
|--------|------|-------------|
| GET | `/storage/pools` | List storage pools |
| GET | `/storage/pools/{pool}/volumes` | List volumes |
| DELETE | `/storage/pools/{pool}/volumes/{vol}` | Delete volume |

### Node

| Method | Path | Description |
|--------|------|-------------|
| GET | `/node` | Host/hypervisor info |

### WebSocket

| Path | Description |
|------|-------------|
| `/ws/v1/watch` | Periodic refresh events |

## License

MIT
