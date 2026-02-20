# virtspawn

**A modern libvirt VM management suite** — Rust daemon with REST/WebSocket API and a keyboard-driven terminal UI.

Manage virtual machines, networks, storage, and snapshots from your terminal with a polished ratatui interface, or integrate with the REST API for automation.

---

## Architecture

```
                    +-----------------------+
                    |    virtspawn-tui       |
                    |   (ratatui terminal)   |
                    +-----------+-----------+
                                |
                          HTTP / WebSocket
                                |
                    +-----------+-----------+
                    |   virtspawn-daemon    |
                    |    (axum REST API)    |
                    +-----------+-----------+
                                |
                           libvirt API
                                |
                    +-----------+-----------+
                    |    QEMU / KVM         |
                    |   Virtual Machines    |
                    +-----------------------+
```

```
virtspawn/
├── virtspawn-core/       Shared library — types, config, libvirt bindings, validation
├── virtspawn-daemon/     REST + WebSocket server (axum) with Prometheus metrics
└── virtspawn-tui/        Terminal UI client (ratatui) with 6 resource views
```

## Features

### VM Management
- **Create** from parameters or templates (linux-small/medium/large, windows, minimal) with auto-generated qcow2 disk, VNC graphics, virtio devices, q35 machine
- **Interactive creation dialog** — form-based VM creation with template dropdown, field validation, Tab navigation (`n` key)
- **Lifecycle** — start, stop (force), shutdown (graceful), reboot, pause, resume, delete with confirmation dialogs
- **Clone** with automatic new UUID and MAC address generation
- **Resize** vCPUs and memory (applies on next boot)
- **Rename** VMs (requires shutoff state)
- **Autostart** toggle per VM
- **Disk management** — hot attach/detach disks to running or stopped VMs
- **Console access** — launch `virt-viewer`, noVNC, SSH, or `virsh console` directly from TUI

### Live Metrics & Monitoring
- **Memory usage** with Unicode block bar graphs (`▁▂▃▄▅▆▇█`)
- **Sparkline trends** — mini sparkline of last 20 metric readings per VM
- **CPU time**, disk I/O (read/write), network I/O (RX/TX)
- **Prometheus endpoint** (`/api/v1/prometheus`) for Grafana integration
- **State transition highlights** — rows flash when a VM changes state

### Snapshots, Networks, Storage
- **Snapshots** — list, create, delete, revert across all VMs
- **Networks** — create, delete, start, stop virtual networks (NAT with DHCP)
- **Storage** — browse pools with capacity/usage, start/stop/refresh pools, volume browser with breadcrumb navigation

### TUI Experience
- **6 resource views** — VMs, Networks, Storage, Snapshots, Events, Node dashboard
- **Resource counts in tabs** — `VMs (3/5)` (running/total), `Networks (2/4)`, etc.
- **Fuzzy search** — character-by-character matching with scored results, not just substring
- **Context-sensitive footer** — shows only relevant keybindings for the selected item's state
- **Modal confirmation dialogs** — centered overlay with resource name and warning
- **Responsive layout** — columns adapt to terminal width (hides/shows columns at 60/80/120/160 cols)
- **Toast notifications** with level-aware icons — `✓` success, `✗` error, `⚠` warning, `ℹ` info
- **Multi-select** — batch operations on multiple VMs (start/stop/reboot/delete all at once)
- **Sorting** — by name, state, CPU, or memory with ascending/descending toggle
- **Context menu** — quick-access action overlay (`Ctrl+Space`)
- **Audit trail** — persistent log at `~/.virtspawn/audit.log`, viewable in Events tab
- **Mouse support** — scroll wheel navigation, click to select rows
- **Command mode** — vim-style `:command` interface

### Infrastructure
- **WebSocket** — real-time VM state change notifications
- **Connection resilience** — auto-reconnects to libvirt if connection drops
- **Systemd service** — hardened unit file with security restrictions
- **Config hierarchy** — user config > system config > defaults > CLI overrides
- **Input validation** — VM names, vCPU counts, memory, disk size bounds checked
- **Graceful shutdown** — daemon handles SIGTERM/SIGINT cleanly
- **Request tracing** — HTTP logging via tower-http

---

## Quick Start

### Prerequisites

- Rust toolchain (1.70+)
- `libvirt-devel` / `libvirt-dev` package
- `qemu-img` (for VM creation)
- Running `libvirtd` service

```bash
# Fedora / RHEL
sudo dnf install libvirt-devel qemu-img
sudo systemctl start libvirtd

# Debian / Ubuntu
sudo apt install libvirt-dev qemu-utils
sudo systemctl start libvirtd
```

### Build & Run

```bash
# Build
make release        # or: cargo build --release --workspace

# Terminal 1 — start the daemon
./target/release/virtspawn-daemon

# Terminal 2 — start the TUI
./target/release/virtspawn-tui
```

### Install System-Wide

```bash
make release
sudo make install
sudo systemctl enable --now virtspawn-daemon
virtspawn-tui
```

This installs binaries to `/usr/local/bin/`, config to `/etc/virtspawn/config.toml`, and the systemd unit.

---

## Configuration

Config files are loaded in order of precedence:

1. CLI arguments (highest priority)
2. `~/.virtspawn/config.toml` (user config)
3. `/etc/virtspawn/config.toml` (system config)
4. Built-in defaults

```toml
[general]
refresh_interval_secs = 5

[daemon]
host = "127.0.0.1"
port = 8081

[libvirt]
uri = "qemu:///system"
```

### CLI Options

```bash
# Daemon
virtspawn-daemon --port 9090 --host 0.0.0.0 --libvirt-uri qemu:///system
virtspawn-daemon --config /path/to/config.toml

# TUI
virtspawn-tui --url http://127.0.0.1:9090
virtspawn-tui --refresh 10
virtspawn-tui --config /path/to/config.toml

# Enable request tracing
RUST_LOG=tower_http=debug virtspawn-daemon
```

---

## TUI Keyboard Reference

### Navigation

| Key | Action |
|-----|--------|
| `j` / `↓` | Move down |
| `k` / `↑` | Move up |
| `g` / `G` | Jump to top / bottom |
| `PageUp` / `PageDown` | Jump 10 items |
| `Tab` / `Shift+Tab` | Next / previous view |
| `1`–`6` | Switch view (VMs, Networks, Storage, Snapshots, Events, Node) |

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
| `Enter` | Show details (metrics, interfaces, disks) |
| `y` | View raw XML (scrollable) |
| `l` | View VM logs |
| `v` | Launch virt-viewer |
| `V` | Open noVNC in browser |
| `c` | Open virsh console |
| `e` | SSH to VM |

### Multi-Select (VMs)

| Key | Action |
|-----|--------|
| `Space` | Toggle selection on current VM |
| `A` | Select all VMs |
| `Esc` | Clear selection |

Selected VMs can be batch-operated with `s`, `x`, `H`, `b`, `p`, `u`, `d`.

### Resource Actions

| Key | Context | Action |
|-----|---------|--------|
| `a` | Networks / Storage | Start |
| `z` | Networks / Storage | Stop |
| `Enter` | Storage | Browse volumes |
| `Backspace` | Volumes | Back to pools |
| `R` | Snapshots | Revert to snapshot |
| `d` | Snapshots | Delete snapshot |

### General

| Key | Action |
|-----|--------|
| `/` | Fuzzy search |
| `:` | Command mode |
| `r` | Refresh current view |
| `Ctrl+Space` | Context menu |
| `N` / `S` / `C` / `M` | Sort by name / state / CPU / memory |
| `?` / `F1` | Help overlay |
| `q` / `Esc` | Quit / close |

### Commands

| Command | Action |
|---------|--------|
| `:create` | Open VM creation dialog |
| `:create <name>` | Create VM with defaults (2 vCPU, 2 GB, 20 GB) |
| `:create <name> <vcpus> <mem>` | Create VM with custom resources |
| `:template <tmpl> <name>` | Create VM from template |
| `:templates` | List available templates |
| `:clone <source> <new>` | Clone a VM |
| `:snap <vm> <name>` | Create a snapshot |
| `:rename <old> <new>` | Rename a VM (must be shutoff) |
| `:resize <name> vcpus <n>` | Set vCPU count (next boot) |
| `:resize <name> memory <mb>` | Set memory in MB (next boot) |
| `:netcreate <name>` | Create a NAT network |
| `:netdelete <name>` | Delete a network |
| `:vms` `:net` `:storage` `:snap` `:events` `:node` | Switch view |
| `:quit` | Quit |

---

## REST API

All endpoints are prefixed with `/api/v1`.

### VMs

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/vms` | List all VMs |
| `POST` | `/vms` | Create VM |
| `GET` | `/vms/{name}` | VM details |
| `DELETE` | `/vms/{name}` | Delete VM |
| `GET` | `/vms/{name}/xml` | Raw XML definition |
| `POST` | `/vms/{name}/start` | Start |
| `POST` | `/vms/{name}/stop` | Force stop |
| `POST` | `/vms/{name}/shutdown` | Graceful shutdown |
| `POST` | `/vms/{name}/reboot` | Reboot |
| `POST` | `/vms/{name}/pause` | Pause |
| `POST` | `/vms/{name}/resume` | Resume |
| `POST` | `/vms/{name}/clone` | Clone (`{"new_name": "..."}`) |
| `POST` | `/vms/{name}/autostart/{bool}` | Set autostart |
| `POST` | `/vms/{name}/vcpus/{count}` | Set vCPU count |
| `POST` | `/vms/{name}/memory/{mb}` | Set max memory |
| `POST` | `/vms/{name}/rename` | Rename (`{"new_name": "..."}`) |
| `POST` | `/vms/{name}/disk/attach` | Attach disk (`{"source": "...", "target": "vdb"}`) |
| `POST` | `/vms/{name}/disk/detach/{target}` | Detach disk |
| `GET` | `/vms/console-info/{name}` | Console type and port |

### Metrics

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/metrics` | All running VM metrics |
| `GET` | `/metrics/{name}` | Single VM metrics |

Returns: CPU time (ns), vCPU count, memory total/used (MB), memory %, disk I/O bytes, network I/O bytes.

### Snapshots

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/snapshots` | All snapshots across VMs |
| `GET` | `/vms/{vm}/snapshots` | Snapshots for a VM |
| `POST` | `/vms/{vm}/snapshots` | Create (`{"name": "...", "description": "..."}`) |
| `DELETE` | `/vms/{vm}/snapshots/{snap}` | Delete |
| `POST` | `/vms/{vm}/snapshots/{snap}/revert` | Revert |

### Networks

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/networks` | List networks |
| `POST` | `/networks` | Create NAT network (`{"name": "...", "subnet": "192.168.100"}`) |
| `DELETE` | `/networks/{name}` | Delete |
| `POST` | `/networks/{name}/start` | Start |
| `POST` | `/networks/{name}/stop` | Stop |
| `GET` | `/networks/{name}/xml` | Network XML |

### Storage

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/storage/pools` | List pools |
| `POST` | `/storage/pools/{name}/start` | Start pool |
| `POST` | `/storage/pools/{name}/stop` | Stop pool |
| `POST` | `/storage/pools/{name}/refresh` | Refresh pool |
| `GET` | `/storage/pools/{pool}/volumes` | List volumes |
| `POST` | `/storage/pools/{pool}/volumes` | Create volume (`{"name": "...", "capacity_gb": 10, "format": "qcow2"}`) |
| `DELETE` | `/storage/pools/{pool}/volumes/{vol}` | Delete volume |

### Other

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/node` | Host and hypervisor info |
| `GET` | `/templates` | Available VM templates |
| `GET` | `/prometheus` | Prometheus exposition format |
| `GET` | `/health` | Daemon health check |
| `WS` | `/ws/v1/watch` | Real-time VM state changes |

---

## VM Templates

Predefined configurations for quick provisioning:

| Template | vCPUs | RAM | Disk | OS |
|----------|-------|-----|------|----|
| `linux-small` | 1 | 1 GB | 10 GB | linux2022 |
| `linux-medium` | 2 | 4 GB | 40 GB | linux2022 |
| `linux-large` | 4 | 8 GB | 80 GB | linux2022 |
| `windows` | 4 | 8 GB | 60 GB | win11 |
| `minimal` | 1 | 512 MB | 5 GB | linux2022 |

```bash
# From command mode
:template linux-medium my-vm

# From the interactive dialog (press 'n', then use ←/→ on Template field)
```

---

## Systemd Service

The daemon ships with a hardened systemd unit:

```bash
sudo make install                              # installs binary + unit + config
sudo systemctl enable --now virtspawn-daemon   # start on boot
sudo systemctl status virtspawn-daemon         # check status
sudo journalctl -u virtspawn-daemon -f         # follow logs
```

Security hardening applied: `ProtectSystem=strict`, `NoNewPrivileges=true`, `PrivateTmp=true`, `ProtectHome=read-only`.

To uninstall:

```bash
sudo systemctl disable --now virtspawn-daemon
sudo make uninstall
```

---

## Makefile Targets

| Target | Description |
|--------|-------------|
| `make release` | Build optimized binaries |
| `make build` | Build debug binaries |
| `sudo make install` | Install binaries, config, and systemd unit |
| `sudo make uninstall` | Remove installed files |
| `make run-daemon` | Run daemon (debug) |
| `make run-tui` | Run TUI (debug) |
| `make fmt` | Format code |
| `make lint` | Run clippy |
| `make test` | Run tests |
| `make clean` | Remove build artifacts |

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Language | Rust |
| Daemon framework | [Axum](https://github.com/tokio-rs/axum) |
| Async runtime | [Tokio](https://tokio.rs) |
| Terminal UI | [Ratatui](https://ratatui.rs) |
| Libvirt bindings | [virt](https://crates.io/crates/virt) |
| HTTP client | [Reqwest](https://crates.io/crates/reqwest) |
| Serialization | [Serde](https://serde.rs) |
| CLI parsing | [Clap](https://clap.rs) |

---

## License

MIT
