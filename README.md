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
- **VM details**: vCPUs, memory, OS type, architecture, network interfaces, disks, UUID
- **Snapshots**: list, create, delete, revert
- **Networks**: list, start, stop
- **Storage**: list pools with capacity/usage, list volumes
- **Node info**: hostname, hypervisor version, CPU model/cores/threads, memory, VM counts
- **TUI**: 5 resource views, search/filter, sort, help screen, details panel, command mode

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
| `1`-`5` | Switch to view (VMs, Networks, Storage, Snapshots, Node) |

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
| `Enter` | Show details |

### Other Actions

| Key | Action |
|-----|--------|
| `/` | Search / filter |
| `:` | Command mode |
| `r` | Refresh |
| `?` / `F1` | Help |
| `N` / `S` / `C` / `M` | Sort by name / state / CPU / memory |
| `a` / `z` | Start / stop network (Networks view) |
| `R` | Revert snapshot (Snapshots view) |
| `q` / `Esc` | Quit / close |

### Commands

| Command | Action |
|---------|--------|
| `:vms` | Switch to VMs view |
| `:net` | Switch to Networks view |
| `:storage` | Switch to Storage view |
| `:snap` | Switch to Snapshots view |
| `:node` | Switch to Node view |
| `:snap <vm> <name>` | Create a snapshot |
| `:quit` | Quit |

## REST API

All endpoints are under `/api/v1/`.

### VMs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/vms` | List all VMs |
| GET | `/vms/{name}` | VM details |
| DELETE | `/vms/{name}` | Delete VM |
| GET | `/vms/{name}/xml` | Raw XML definition |
| POST | `/vms/{name}/start` | Start |
| POST | `/vms/{name}/stop` | Force stop |
| POST | `/vms/{name}/shutdown` | Graceful shutdown |
| POST | `/vms/{name}/reboot` | Reboot |
| POST | `/vms/{name}/pause` | Pause |
| POST | `/vms/{name}/resume` | Resume |
| POST | `/vms/{name}/autostart/{bool}` | Set autostart |

### Snapshots

| Method | Path | Description |
|--------|------|-------------|
| GET | `/snapshots` | List all snapshots |
| GET | `/vms/{vm}/snapshots` | List VM snapshots |
| POST | `/vms/{vm}/snapshots` | Create snapshot |
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
