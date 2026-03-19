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

### Workspace Layout

```
virtspawn/
├── core/       Shared library — types, config, libvirt bindings, validation, XML helpers
├── daemon/     REST + WebSocket server (axum) with Prometheus metrics
├── tui/        Terminal UI client (ratatui) with sidebar + content panel layout
├── contrib/    Systemd unit, default config
└── examples/   Example user configuration
```

---

## Features

### VM Management
- **Create** from parameters or templates (linux-small/medium/large, windows, minimal) with auto-generated qcow2 disk, VNC graphics, virtio devices, q35 machine type
- **Interactive creation dialog** — form-based VM creation with template dropdown, field validation, Tab navigation (`n` key)
- **Lifecycle** — start, stop (force), shutdown (graceful), reboot, pause, resume, delete with confirmation dialogs
- **Clone** with automatic UUID regeneration and unique MAC addresses
- **Resize** vCPUs and memory (applies on next boot)
- **Rename** VMs (requires shutoff state)
- **Autostart** toggle per VM, network, and storage pool
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
- **Networks** — create, delete, start, stop, toggle autostart for virtual networks (NAT with DHCP)
- **Storage** — browse pools with capacity/usage, start/stop/refresh pools, toggle autostart, volume browser with breadcrumb navigation

### TUI Experience
- **vSphere-style sidebar + content layout** — left inventory tree with collapsible categories, right content panel with object-specific views
- **Sub-tabs per object** — Summary, Monitor, Configure tabs for VMs with `Tab`/`1`/`2`/`3` switching
- **Focus model** — `h`/`←` focuses sidebar, `l`/`→` focuses content panel; borders highlight active panel
- **Inventory sidebar** — collapsible VMs/Networks/Storage/Snapshots groups with state indicators and running/total counts
- **Resource counts** — `VMs (3/5)` (running/total), `Networks (2/4)` (active/total), etc.
- **Fuzzy search** — character-by-character matching with scored results, not just substring
- **Context-sensitive footer** — shows only relevant keybindings based on focus panel and selected item state
- **Recent tasks bar** — last 3 audit events shown with color-coded results
- **Modal confirmation dialogs** — centered overlay with resource name and warning
- **Responsive layout** — sidebar width auto-adjusts (22-30 chars), content columns adapt to terminal width
- **Toast notifications** with level-aware icons — `✓` success, `✗` error, `⚠` warning, `ℹ` info
- **Multi-select** — batch operations on multiple VMs (start/stop/reboot/delete all at once)
- **Sorting** — by name, state, CPU, or memory with ascending/descending toggle
- **Context menu** — quick-access action overlay (`Ctrl+Space`)
- **Audit trail** — persistent log at `~/.virtspawn/audit.log`, viewable via `:events` command
- **Mouse support** — click to select sidebar items or content rows, scroll wheel navigates per-panel
- **Command mode** — vim-style `:command` interface

### Infrastructure
- **WebSocket** — real-time VM state change notifications
- **Connection resilience** — auto-reconnects to libvirt if connection drops
- **Systemd service** — hardened unit file with security restrictions
- **Config hierarchy** — user config > system config > defaults > CLI overrides
- **Input validation** — VM names, vCPU counts, memory, disk size bounds checked; XML-escaped user inputs
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
# Fedora / RHEL / CentOS
sudo dnf install libvirt-devel qemu-img
sudo systemctl enable --now libvirtd

# Debian / Ubuntu
sudo apt install libvirt-dev qemu-utils
sudo systemctl enable --now libvirtd

# Arch Linux
sudo pacman -S libvirt qemu-base
sudo systemctl enable --now libvirtd

# openSUSE
sudo zypper install libvirt-devel qemu-tools
sudo systemctl enable --now libvirtd
```

### Build & Run

```bash
# Clone the repository
git clone https://github.com/ssahani/-virtspawn.git
cd virtspawn

# Build optimized release binaries
make release

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
virtspawn   # the TUI binary is installed as 'virtspawn'
```

This installs:
- `virtspawn-daemon` → `/usr/local/bin/virtspawn-daemon`
- `virtspawn` (TUI) → `/usr/local/bin/virtspawn`
- Config → `/etc/virtspawn/config.toml`
- Systemd unit → `/usr/lib/systemd/system/virtspawn-daemon.service`

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
host = "127.0.0.1"           # Bind address
port = 8081                  # Bind port

[libvirt]
uri = "qemu:///system"       # Libvirt connection URI
```

See [`examples/config.toml`](examples/config.toml) for the full annotated configuration.

### CLI Options

**Daemon:**

```bash
virtspawn-daemon                                    # defaults
virtspawn-daemon --port 9090 --host 0.0.0.0         # custom bind
virtspawn-daemon --libvirt-uri qemu:///session       # user session
virtspawn-daemon --config /path/to/config.toml      # custom config
virtspawn-daemon -p 9090                            # short flag for port
RUST_LOG=tower_http=debug virtspawn-daemon          # enable request tracing
```

**TUI:**

```bash
virtspawn                                           # defaults
virtspawn --url http://192.168.1.10:8081            # remote daemon
virtspawn --refresh 10                              # 10s refresh interval
virtspawn --config /path/to/config.toml             # custom config
virtspawn -u http://localhost:9090                   # short flag for url
```

---

## TUI Keyboard Reference

### Panel Navigation

| Key | Action |
|-----|--------|
| `h` / `←` | Focus sidebar panel |
| `l` / `→` | Focus content panel (`l` on a VM opens logs instead) |
| `j` / `↓` | Move down (sidebar: items, content: rows or scroll) |
| `k` / `↑` | Move up |
| `g` / `G` | Jump to top / bottom |
| `PageUp` / `PageDown` | Jump 10 items |

### Sidebar

| Key | Action |
|-----|--------|
| `Space` | Collapse/expand category, or toggle multi-select on VM |
| `Enter` | Expand/collapse category, or select object and focus content |
| `Backspace` | Exit volume browser (back to pools) |

### Content Sub-Tabs (when a VM is selected)

| Key | Action |
|-----|--------|
| `Tab` / `Shift+Tab` | Cycle through Summary → Monitor → Configure |
| `1` | Summary tab |
| `2` | Monitor tab |
| `3` | Configure tab |

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
| `t` | Networks / Storage | Toggle autostart |
| `y` | Networks | View XML |
| `d` | Networks / Snapshots / Volumes | Delete (with confirmation) |
| `Enter` | Storage pools | Browse volumes |
| `Backspace` | Volumes | Back to pools |
| `n` | Snapshots | Create snapshot (opens command pre-filled) |
| `R` | Snapshots | Revert to snapshot |
| `r` | Storage pools | Refresh pool |

### General

| Key | Action |
|-----|--------|
| `/` | Fuzzy search |
| `:` | Command mode |
| `r` | Refresh current view |
| `Ctrl+Space` | Context menu |
| `N` / `S` / `C` / `M` | Sort by name / state / CPU / memory |
| `?` / `F1` | Help overlay (scrollable) |
| `q` / `Esc` | Quit / close overlay / clear selection |

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
| `:quit` / `:q` | Quit |

---

## REST API

All endpoints are prefixed with `/api/v1`. Responses are JSON.

### VMs

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/vms` | List all VMs |
| `POST` | `/vms` | Create VM (`{"name": "...", "vcpus": 2, "memory_mb": 2048, ...}`) |
| `GET` | `/vms/{name}` | VM details (UUID, state, interfaces, disks) |
| `DELETE` | `/vms/{name}` | Delete VM (stops if running, then undefines) |
| `GET` | `/vms/{name}/xml` | Raw libvirt XML definition |
| `POST` | `/vms/{name}/start` | Start |
| `POST` | `/vms/{name}/stop` | Force stop (destroy) |
| `POST` | `/vms/{name}/shutdown` | Graceful ACPI shutdown |
| `POST` | `/vms/{name}/reboot` | Reboot |
| `POST` | `/vms/{name}/pause` | Suspend |
| `POST` | `/vms/{name}/resume` | Resume |
| `POST` | `/vms/{name}/clone` | Clone (`{"new_name": "..."}`) |
| `POST` | `/vms/{name}/autostart/{enabled}` | Set autostart (`true`/`false`) |
| `POST` | `/vms/{name}/vcpus/{count}` | Set vCPU count (config, next boot) |
| `POST` | `/vms/{name}/memory/{mb}` | Set max memory in MB (next boot) |
| `POST` | `/vms/{name}/rename` | Rename (`{"new_name": "..."}`, must be shutoff) |
| `POST` | `/vms/{name}/disk/attach` | Attach disk (`{"source": "/path/to/img", "target": "vdb", "driver": "qcow2"}`) |
| `POST` | `/vms/{name}/disk/detach/{target}` | Detach disk by target device (e.g. `vdb`) |
| `GET` | `/vms/console-info/{name}` | Console type, VNC/SPICE port, websocket port |

### Metrics

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/metrics` | All running VM metrics |
| `GET` | `/metrics/{name}` | Single VM metrics |

Response fields: `cpu_time_ns`, `vcpus`, `memory_total_mb`, `memory_used_mb`, `memory_pct`, `disk_rd_bytes`, `disk_wr_bytes`, `net_rx_bytes`, `net_tx_bytes`.

### Snapshots

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/snapshots` | All snapshots across all VMs |
| `GET` | `/vms/{vm}/snapshots` | Snapshots for a specific VM |
| `POST` | `/vms/{vm}/snapshots` | Create (`{"name": "...", "description": "..."}`) |
| `DELETE` | `/vms/{vm}/snapshots/{snap}` | Delete snapshot |
| `POST` | `/vms/{vm}/snapshots/{snap}/revert` | Revert VM to snapshot |

### Networks

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/networks` | List all virtual networks |
| `POST` | `/networks` | Create NAT network (`{"name": "...", "subnet": "192.168.100", ...}`) |
| `DELETE` | `/networks/{name}` | Delete (stops first if active) |
| `POST` | `/networks/{name}/start` | Start network |
| `POST` | `/networks/{name}/stop` | Stop network |
| `GET` | `/networks/{name}/xml` | Network XML definition |
| `POST` | `/networks/{name}/autostart/{enabled}` | Set autostart |

### Storage

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/storage/pools` | List all storage pools |
| `POST` | `/storage/pools/{name}/start` | Activate pool |
| `POST` | `/storage/pools/{name}/stop` | Deactivate pool |
| `POST` | `/storage/pools/{name}/refresh` | Refresh pool metadata |
| `POST` | `/storage/pools/{name}/autostart/{enabled}` | Set pool autostart |
| `GET` | `/storage/pools/{pool}/volumes` | List volumes in a pool |
| `POST` | `/storage/pools/{pool}/volumes` | Create volume (`{"name": "...", "capacity_gb": 10, "format": "qcow2"}`) |
| `DELETE` | `/storage/pools/{pool}/volumes/{vol}` | Delete volume |

### Other

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/node` | Host info: hostname, hypervisor, CPU, memory, VM counts |
| `GET` | `/templates` | Available VM templates with specs |
| `GET` | `/prometheus` | Metrics in Prometheus exposition format |
| `GET` | `/health` | Health check (returns libvirt connection status) |
| `WS` | `/ws/v1/watch` | Real-time VM state change notifications |

### API Examples

```bash
# List all VMs
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
  -d '{"name": "before-upgrade", "description": "Pre-upgrade checkpoint"}' | jq

# Clone a VM
curl -s -X POST http://localhost:8081/api/v1/vms/test-vm/clone \
  -H 'Content-Type: application/json' \
  -d '{"new_name": "test-vm-clone"}' | jq

# Create a network
curl -s -X POST http://localhost:8081/api/v1/networks \
  -H 'Content-Type: application/json' \
  -d '{"name": "lab-net", "subnet": "10.0.0", "dhcp_start": "10.0.0.100", "dhcp_end": "10.0.0.200"}' | jq

# Check host info
curl -s http://localhost:8081/api/v1/node | jq

# Prometheus metrics (for Grafana scraping)
curl -s http://localhost:8081/api/v1/prometheus

# WebSocket — watch VM state changes
websocat ws://localhost:8081/ws/v1/watch
```

---

## VM Templates

Predefined configurations for quick provisioning:

| Template | vCPUs | RAM | Disk | OS Variant |
|----------|-------|-----|------|------------|
| `linux-small` | 1 | 1 GB | 10 GB | linux2022 |
| `linux-medium` | 2 | 4 GB | 40 GB | linux2022 |
| `linux-large` | 4 | 8 GB | 80 GB | linux2022 |
| `windows` | 4 | 8 GB | 60 GB | win11 |
| `minimal` | 1 | 512 MB | 5 GB | linux2022 |

**Usage:**

```bash
# TUI command mode
:template linux-medium my-vm

# Interactive dialog — press 'n', then use ←/→ on the Template field

# REST API
curl -s -X POST http://localhost:8081/api/v1/vms \
  -H 'Content-Type: application/json' \
  -d '{"name": "my-vm", "vcpus": 2, "memory_mb": 4096, "disk_gb": 40}'
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

Security hardening applied:
- `ProtectSystem=strict` — filesystem is read-only except explicitly listed paths
- `ProtectHome=read-only` — home directories are read-only
- `NoNewPrivileges=true` — prevents privilege escalation
- `PrivateTmp=true` — isolated `/tmp`
- `ReadWritePaths=/var/lib/libvirt` — allows writing disk images

To uninstall:

```bash
sudo systemctl disable --now virtspawn-daemon
sudo make uninstall
```

---

## Makefile Targets

```
make help       # Show all targets with descriptions
```

| Target | Description |
|--------|-------------|
| `make` / `make build` | Build in debug mode |
| `make release` | Build optimized release binaries |
| `make test` | Run all tests |
| `make fmt` | Format code with `rustfmt` |
| `make fmt-check` | Check formatting (CI-friendly) |
| `make lint` | Run clippy lints |
| `make check` | Run `cargo check` |
| `make clean` | Remove build artifacts |
| `sudo make install` | Install binaries, config, and systemd unit |
| `sudo make uninstall` | Remove installed files |
| `make run-daemon` | Run daemon in debug mode |
| `make run-tui` | Run TUI in debug mode |

---

## Troubleshooting

### Daemon won't start

```bash
# Check if libvirtd is running
sudo systemctl status libvirtd

# Test libvirt connectivity directly
virsh -c qemu:///system list --all

# Check daemon logs
journalctl -u virtspawn-daemon -e

# Run daemon with debug logging
RUST_LOG=debug virtspawn-daemon
```

### TUI can't connect to daemon

```bash
# Verify daemon is listening
curl http://127.0.0.1:8081/api/v1/health

# Connect to a remote daemon
virtspawn --url http://192.168.1.10:8081

# Check for port conflicts
ss -tlnp | grep 8081
```

### Permission denied errors

```bash
# Add your user to the libvirt group
sudo usermod -aG libvirt $USER
newgrp libvirt

# Or use the session URI (no root needed, fewer features)
virtspawn-daemon --libvirt-uri qemu:///session
```

### VM creation fails

```bash
# Verify qemu-img is installed
qemu-img --version

# Check the default storage pool exists and is active
virsh pool-list --all
virsh pool-start default  # if inactive

# Verify the storage pool path is writable
ls -la /var/lib/libvirt/images/
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Language | [Rust](https://www.rust-lang.org/) |
| Daemon framework | [Axum](https://github.com/tokio-rs/axum) |
| Async runtime | [Tokio](https://tokio.rs) |
| Terminal UI | [Ratatui](https://ratatui.rs) |
| Libvirt bindings | [virt](https://crates.io/crates/virt) |
| HTTP client | [Reqwest](https://crates.io/crates/reqwest) |
| Serialization | [Serde](https://serde.rs) + [serde_json](https://crates.io/crates/serde_json) |
| Config parsing | [TOML](https://crates.io/crates/toml) |
| CLI parsing | [Clap](https://clap.rs) (derive) |
| Error handling | [anyhow](https://crates.io/crates/anyhow) + [thiserror](https://crates.io/crates/thiserror) |
| Logging | [tracing](https://crates.io/crates/tracing) + [tower-http](https://crates.io/crates/tower-http) |

---

## Contributing

Contributions are welcome! To get started:

```bash
git clone https://github.com/ssahani/-virtspawn.git
cd virtspawn
make build          # debug build
make test           # run tests
make lint           # clippy
make fmt-check      # formatting check
```

Before submitting a PR:
1. Run `make test` — all tests must pass
2. Run `make lint` — no clippy warnings allowed
3. Run `make fmt` — code must be formatted

---

## License

MIT
