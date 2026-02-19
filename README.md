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

- **VM creation**: create VMs from parameters with auto-generated qcow2 disk, VNC, virtio, q35 machine type
- **VM lifecycle**: start, stop (force), shutdown (graceful), reboot, pause, resume, delete, autostart toggle
- **VM cloning**: clone VMs with automatic new UUID and MAC address generation
- **VM resize**: adjust vCPUs and memory (takes effect on next boot)
- **VM details**: vCPUs, memory, OS type, architecture, network interfaces, disks, UUID
- **VM XML viewer**: browse raw libvirt XML with scrollable view
- **VM metrics**: memory usage %, CPU time, disk I/O (read/write), network I/O (RX/TX)
- **Snapshots**: list, create, delete, revert across all VMs
- **Networks**: list, start, stop virtual networks
- **Storage**: list pools with capacity/usage, start/stop/refresh pools, list volumes
- **Node info**: hostname, hypervisor version, CPU model/cores/threads, memory, VM counts
- **Health check**: daemon health endpoint to verify libvirt connectivity
- **Multi-select**: select multiple VMs and batch start/stop/reboot/pause/resume/delete
- **Audit trail**: persistent log at `~/.virtspawn/audit.log`, loaded on startup, viewable in Events tab
- **Context menu**: quick-access action overlay for the selected resource
- **Console access**: launch `virt-viewer` for graphical console directly from TUI
- **Input validation**: VM names, vCPU counts, memory, and disk size bounds checked
- **Connection resilience**: auto-reconnects to libvirt if connection drops
- **Graceful shutdown**: daemon handles SIGTERM/SIGINT cleanly
- **Request tracing**: HTTP request logging via tower-http (enable with `RUST_LOG=tower_http=debug`)
- **CLI arguments**: both daemon and TUI support command-line flags to override config
- **TUI**: 6 resource views, search/filter, sort, help screen, details panel, command mode

## Prerequisites

- Rust toolchain (1.70+)
- `libvirt-devel` / `libvirt-dev` package
- `qemu-img` (for VM creation)
- Running `libvirtd` service

```bash
# Fedora/RHEL
sudo dnf install libvirt-devel qemu-img

# Debian/Ubuntu
sudo apt install libvirt-dev qemu-utils

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

# With options:
virtspawn-daemon --port 9090 --libvirt-uri qemu:///system
virtspawn-daemon --config /path/to/config.toml
```

In another terminal, start the TUI:

```bash
cargo run -p virtspawn-tui

# With options:
virtspawn-tui --url http://127.0.0.1:9090
virtspawn-tui --refresh 10
virtspawn-tui --config /path/to/config.toml
```

Enable request tracing on the daemon:

```bash
RUST_LOG=tower_http=debug virtspawn-daemon
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

CLI arguments override config file values. An example config is provided in `examples/config.toml`.

## TUI Keyboard Shortcuts

### Navigation

| Key | Action |
|-----|--------|
| `j` / `Down` | Move down |
| `k` / `Up` | Move up |
| `g` | Go to top |
| `G` | Go to bottom |
| `PageUp` / `PageDown` | Jump 10 items |
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
| `t` | Toggle autostart |
| `o` | Clone (shows command hint) |
| `Enter` | Show details (metrics, interfaces, disks, I/O stats) |
| `y` | View raw XML (scrollable with j/k, PageUp/PageDown) |
| `v` | Launch virt-viewer |
| `c` | Console hint |

### Multi-select (VMs view)

| Key | Action |
|-----|--------|
| `Space` | Toggle selection on current VM |
| `A` | Select all VMs |
| `Esc` | Clear selection |

When VMs are selected, actions (`s`, `x`, `H`, `b`, `p`, `u`, `d`) apply to all selected VMs as a batch operation.

### Network / Storage Actions

| Key | Action |
|-----|--------|
| `a` | Start network or storage pool |
| `z` | Stop network or storage pool |

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
| `:create <name>` | Create VM (defaults: 2 vCPU, 2 GB RAM, 20 GB disk) |
| `:create <name> <vcpus> <memory_mb>` | Create VM with custom resources |
| `:snap <vm> <name>` | Create a snapshot |
| `:clone <source> <new-name>` | Clone a VM |
| `:resize <name> vcpus <count>` | Set vCPU count (next boot) |
| `:resize <name> memory <mb>` | Set max memory in MB (next boot) |
| `:quit` | Quit |

## REST API

All endpoints are under `/api/v1/`.

### VMs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/vms` | List all VMs |
| POST | `/vms` | Create VM (body: `{"name": "...", "vcpus": 2, "memory_mb": 2048, "disk_gb": 20}`) |
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
| POST | `/vms/{name}/vcpus/{count}` | Set vCPU count (config) |
| POST | `/vms/{name}/memory/{mb}` | Set max memory in MB |

### Metrics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/metrics` | Metrics for all running VMs |
| GET | `/metrics/{name}` | Metrics for a single VM |

Returns CPU time (ns), vCPU count, memory total/used (MB), memory %, disk I/O (read/write bytes), network I/O (RX/TX bytes).

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
| POST | `/storage/pools/{name}/start` | Start pool |
| POST | `/storage/pools/{name}/stop` | Stop pool |
| POST | `/storage/pools/{name}/refresh` | Refresh pool |
| GET | `/storage/pools/{pool}/volumes` | List volumes |
| DELETE | `/storage/pools/{pool}/volumes/{vol}` | Delete volume |

### Node

| Method | Path | Description |
|--------|------|-------------|
| GET | `/node` | Host/hypervisor info |

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Daemon health check |

### WebSocket

| Path | Description |
|------|-------------|
| `/ws/v1/watch` | Periodic refresh events |

## License

MIT
