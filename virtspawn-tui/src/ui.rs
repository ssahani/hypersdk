use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{
    Block, Borders, Cell, Clear, Paragraph, Row, Table, Wrap,
};
use ratatui::Frame;

use virtspawn_core::{AppState, InputMode, ResourceView, ViewMode};

pub fn render(frame: &mut Frame, state: &AppState) {
    let chunks = Layout::vertical([
        Constraint::Length(1), // Tab bar
        Constraint::Min(0),   // Main content
        Constraint::Length(1), // Status bar
        Constraint::Length(1), // Help hint / search / command
    ])
    .split(frame.area());

    render_tab_bar(frame, chunks[0], state);

    match state.view_mode {
        ViewMode::Table => render_table_view(frame, chunks[1], state),
        ViewMode::Details => render_details_view(frame, chunks[1], state),
        ViewMode::Help => {
            render_table_view(frame, chunks[1], state);
            render_help_overlay(frame, frame.area());
        }
    }

    render_status_bar(frame, chunks[2], state);
    render_bottom_bar(frame, chunks[3], state);
}

// ── Tab bar ─────────────────────────────────────────────────────────────

fn render_tab_bar(frame: &mut Frame, area: Rect, state: &AppState) {
    let tabs: Vec<Span> = ResourceView::all()
        .iter()
        .enumerate()
        .flat_map(|(i, view)| {
            let num = format!("{}:", i + 1);
            let label = view.label();
            let is_active = *view == state.resource_view;

            let style = if is_active {
                Style::default().fg(Color::Black).bg(Color::Cyan)
            } else {
                Style::default().fg(Color::DarkGray)
            };

            let spans = vec![
                Span::styled(num, style),
                Span::styled(label, style),
                Span::raw("  "),
            ];
            spans
        })
        .collect();

    let line = Line::from(tabs);
    frame.render_widget(Paragraph::new(line), area);
}

// ── Table view dispatch ─────────────────────────────────────────────────

fn render_table_view(frame: &mut Frame, area: Rect, state: &AppState) {
    match state.resource_view {
        ResourceView::VirtualMachines => render_vm_table(frame, area, state),
        ResourceView::Networks => render_network_table(frame, area, state),
        ResourceView::StoragePools => render_storage_table(frame, area, state),
        ResourceView::Snapshots => render_snapshot_table(frame, area, state),
        ResourceView::Node => render_node_view(frame, area, state),
    }
}

// ── VM table ────────────────────────────────────────────────────────────

fn render_vm_table(frame: &mut Frame, area: Rect, state: &AppState) {
    let header = Row::new(vec![
        Cell::from("Name"),
        Cell::from("State"),
        Cell::from("vCPUs"),
        Cell::from("Memory (MB)"),
    ])
    .style(
        Style::default()
            .fg(Color::Yellow)
            .add_modifier(Modifier::BOLD),
    );

    let items: Vec<(usize, _)> = if !state.filtered_indices.is_empty() {
        state
            .filtered_indices
            .iter()
            .filter_map(|&i| state.vms.get(i).map(|vm| (i, vm)))
            .collect()
    } else {
        state.vms.iter().enumerate().collect()
    };

    let rows: Vec<Row> = items
        .iter()
        .enumerate()
        .map(|(display_idx, (_real_idx, vm))| {
            let state_color = match vm.state.as_str() {
                "running" => Color::Green,
                "shutoff" => Color::Red,
                "paused" => Color::Yellow,
                "crashed" => Color::Magenta,
                _ => Color::Gray,
            };

            let row = Row::new(vec![
                Cell::from(vm.name.clone()),
                Cell::from(vm.state.clone()).style(Style::default().fg(state_color)),
                Cell::from(vm.vcpus.to_string()),
                Cell::from(vm.memory_mb.to_string()),
            ]);

            if display_idx == state.selected_index {
                row.style(
                    Style::default()
                        .bg(Color::DarkGray)
                        .add_modifier(Modifier::BOLD),
                )
            } else {
                row
            }
        })
        .collect();

    let title = format!(
        " VMs ({}) ",
        if state.filtered_indices.is_empty() {
            state.vms.len()
        } else {
            state.filtered_indices.len()
        }
    );

    let table = Table::new(
        rows,
        [
            Constraint::Percentage(35),
            Constraint::Percentage(20),
            Constraint::Percentage(15),
            Constraint::Percentage(30),
        ],
    )
    .header(header)
    .block(Block::default().borders(Borders::ALL).title(title));

    frame.render_widget(table, area);
}

// ── Network table ───────────────────────────────────────────────────────

fn render_network_table(frame: &mut Frame, area: Rect, state: &AppState) {
    let header = Row::new(vec![
        Cell::from("Name"),
        Cell::from("Active"),
        Cell::from("Autostart"),
        Cell::from("Bridge"),
        Cell::from("Persistent"),
    ])
    .style(
        Style::default()
            .fg(Color::Yellow)
            .add_modifier(Modifier::BOLD),
    );

    let rows: Vec<Row> = state
        .networks
        .iter()
        .enumerate()
        .map(|(i, net)| {
            let active_color = if net.active { Color::Green } else { Color::Red };
            let row = Row::new(vec![
                Cell::from(net.name.clone()),
                Cell::from(if net.active { "yes" } else { "no" })
                    .style(Style::default().fg(active_color)),
                Cell::from(if net.autostart { "yes" } else { "no" }),
                Cell::from(net.bridge.clone()),
                Cell::from(if net.persistent { "yes" } else { "no" }),
            ]);

            if i == state.selected_index {
                row.style(
                    Style::default()
                        .bg(Color::DarkGray)
                        .add_modifier(Modifier::BOLD),
                )
            } else {
                row
            }
        })
        .collect();

    let title = format!(" Networks ({}) ", state.networks.len());

    let table = Table::new(
        rows,
        [
            Constraint::Percentage(25),
            Constraint::Percentage(15),
            Constraint::Percentage(15),
            Constraint::Percentage(25),
            Constraint::Percentage(20),
        ],
    )
    .header(header)
    .block(Block::default().borders(Borders::ALL).title(title));

    frame.render_widget(table, area);
}

// ── Storage table ───────────────────────────────────────────────────────

fn render_storage_table(frame: &mut Frame, area: Rect, state: &AppState) {
    let header = Row::new(vec![
        Cell::from("Name"),
        Cell::from("State"),
        Cell::from("Capacity (GB)"),
        Cell::from("Used (GB)"),
        Cell::from("Available (GB)"),
        Cell::from("Autostart"),
    ])
    .style(
        Style::default()
            .fg(Color::Yellow)
            .add_modifier(Modifier::BOLD),
    );

    let rows: Vec<Row> = state
        .storage_pools
        .iter()
        .enumerate()
        .map(|(i, pool)| {
            let state_color = match pool.state.as_str() {
                "running" => Color::Green,
                "inactive" => Color::Red,
                _ => Color::Gray,
            };

            let row = Row::new(vec![
                Cell::from(pool.name.clone()),
                Cell::from(pool.state.clone()).style(Style::default().fg(state_color)),
                Cell::from(format!("{:.1}", pool.capacity_gb)),
                Cell::from(format!("{:.1}", pool.allocation_gb)),
                Cell::from(format!("{:.1}", pool.available_gb)),
                Cell::from(if pool.autostart { "yes" } else { "no" }),
            ]);

            if i == state.selected_index {
                row.style(
                    Style::default()
                        .bg(Color::DarkGray)
                        .add_modifier(Modifier::BOLD),
                )
            } else {
                row
            }
        })
        .collect();

    let title = format!(" Storage Pools ({}) ", state.storage_pools.len());

    let table = Table::new(
        rows,
        [
            Constraint::Percentage(20),
            Constraint::Percentage(15),
            Constraint::Percentage(18),
            Constraint::Percentage(15),
            Constraint::Percentage(18),
            Constraint::Percentage(14),
        ],
    )
    .header(header)
    .block(Block::default().borders(Borders::ALL).title(title));

    frame.render_widget(table, area);
}

// ── Snapshot table ──────────────────────────────────────────────────────

fn render_snapshot_table(frame: &mut Frame, area: Rect, state: &AppState) {
    let header = Row::new(vec![
        Cell::from("VM"),
        Cell::from("Snapshot"),
        Cell::from("State"),
        Cell::from("Current"),
        Cell::from("Parent"),
    ])
    .style(
        Style::default()
            .fg(Color::Yellow)
            .add_modifier(Modifier::BOLD),
    );

    let rows: Vec<Row> = state
        .snapshots
        .iter()
        .enumerate()
        .map(|(i, snap)| {
            let row = Row::new(vec![
                Cell::from(snap.vm_name.clone()),
                Cell::from(snap.name.clone()),
                Cell::from(snap.state.clone()),
                Cell::from(if snap.is_current { "*" } else { "" })
                    .style(Style::default().fg(Color::Green)),
                Cell::from(snap.parent.clone()),
            ]);

            if i == state.selected_index {
                row.style(
                    Style::default()
                        .bg(Color::DarkGray)
                        .add_modifier(Modifier::BOLD),
                )
            } else {
                row
            }
        })
        .collect();

    let title = format!(" Snapshots ({}) ", state.snapshots.len());

    let table = Table::new(
        rows,
        [
            Constraint::Percentage(25),
            Constraint::Percentage(25),
            Constraint::Percentage(20),
            Constraint::Percentage(10),
            Constraint::Percentage(20),
        ],
    )
    .header(header)
    .block(Block::default().borders(Borders::ALL).title(title));

    frame.render_widget(table, area);
}

// ── Node view ───────────────────────────────────────────────────────────

fn render_node_view(frame: &mut Frame, area: Rect, state: &AppState) {
    let text = if let Some(ref node) = state.node_info {
        vec![
            Line::from(vec![
                Span::styled("Hostname:       ", Style::default().fg(Color::Yellow)),
                Span::raw(&node.hostname),
            ]),
            Line::from(vec![
                Span::styled("Hypervisor:     ", Style::default().fg(Color::Yellow)),
                Span::raw(format!("{} {}", node.hypervisor, node.hypervisor_version)),
            ]),
            Line::from(vec![
                Span::styled("Libvirt:        ", Style::default().fg(Color::Yellow)),
                Span::raw(&node.lib_version),
            ]),
            Line::from(""),
            Line::from(vec![
                Span::styled("CPU Model:      ", Style::default().fg(Color::Yellow)),
                Span::raw(&node.cpu_model),
            ]),
            Line::from(vec![
                Span::styled("CPU Sockets:    ", Style::default().fg(Color::Yellow)),
                Span::raw(node.cpu_sockets.to_string()),
            ]),
            Line::from(vec![
                Span::styled("CPU Cores:      ", Style::default().fg(Color::Yellow)),
                Span::raw(node.cpu_cores.to_string()),
            ]),
            Line::from(vec![
                Span::styled("CPU Threads:    ", Style::default().fg(Color::Yellow)),
                Span::raw(node.cpu_threads.to_string()),
            ]),
            Line::from(vec![
                Span::styled("NUMA Nodes:     ", Style::default().fg(Color::Yellow)),
                Span::raw(node.numa_nodes.to_string()),
            ]),
            Line::from(""),
            Line::from(vec![
                Span::styled("Memory:         ", Style::default().fg(Color::Yellow)),
                Span::raw(format!("{} MB", node.memory_mb)),
            ]),
            Line::from(""),
            Line::from(vec![
                Span::styled("Active VMs:     ", Style::default().fg(Color::Yellow)),
                Span::styled(
                    node.active_vms.to_string(),
                    Style::default().fg(Color::Green),
                ),
            ]),
            Line::from(vec![
                Span::styled("Defined VMs:    ", Style::default().fg(Color::Yellow)),
                Span::raw(node.defined_vms.to_string()),
            ]),
        ]
    } else {
        vec![Line::from("Loading node info...")]
    };

    let block = Block::default().borders(Borders::ALL).title(" Node Info ");
    let paragraph = Paragraph::new(text).block(block);
    frame.render_widget(paragraph, area);
}

// ── Details view ────────────────────────────────────────────────────────

fn render_details_view(frame: &mut Frame, area: Rect, state: &AppState) {
    let text = if let Some(ref d) = state.vm_details {
        let mut lines = vec![
            Line::from(vec![
                Span::styled("Name:        ", Style::default().fg(Color::Yellow)),
                Span::raw(&d.name),
            ]),
            Line::from(vec![
                Span::styled("UUID:        ", Style::default().fg(Color::Yellow)),
                Span::raw(&d.uuid),
            ]),
            Line::from(vec![
                Span::styled("State:       ", Style::default().fg(Color::Yellow)),
                Span::styled(
                    &d.state,
                    Style::default().fg(match d.state.as_str() {
                        "running" => Color::Green,
                        "shutoff" => Color::Red,
                        "paused" => Color::Yellow,
                        _ => Color::Gray,
                    }),
                ),
            ]),
            Line::from(vec![
                Span::styled("vCPUs:       ", Style::default().fg(Color::Yellow)),
                Span::raw(d.vcpus.to_string()),
            ]),
            Line::from(vec![
                Span::styled("Memory:      ", Style::default().fg(Color::Yellow)),
                Span::raw(format!("{} MB", d.memory_mb)),
            ]),
            Line::from(vec![
                Span::styled("OS Type:     ", Style::default().fg(Color::Yellow)),
                Span::raw(&d.os_type),
            ]),
            Line::from(vec![
                Span::styled("Arch:        ", Style::default().fg(Color::Yellow)),
                Span::raw(&d.arch),
            ]),
            Line::from(vec![
                Span::styled("Persistent:  ", Style::default().fg(Color::Yellow)),
                Span::raw(if d.persistent { "yes" } else { "no" }),
            ]),
            Line::from(vec![
                Span::styled("Autostart:   ", Style::default().fg(Color::Yellow)),
                Span::raw(if d.autostart { "yes" } else { "no" }),
            ]),
        ];

        if !d.interfaces.is_empty() {
            lines.push(Line::from(""));
            lines.push(Line::from(Span::styled(
                "Interfaces:",
                Style::default()
                    .fg(Color::Cyan)
                    .add_modifier(Modifier::BOLD),
            )));
            for iface in &d.interfaces {
                lines.push(Line::from(format!(
                    "  MAC: {}  Source: {}  Model: {}",
                    iface.mac_address, iface.source, iface.model
                )));
            }
        }

        if !d.disks.is_empty() {
            lines.push(Line::from(""));
            lines.push(Line::from(Span::styled(
                "Disks:",
                Style::default()
                    .fg(Color::Cyan)
                    .add_modifier(Modifier::BOLD),
            )));
            for disk in &d.disks {
                lines.push(Line::from(format!(
                    "  {} ({})  Target: {}  Driver: {}",
                    disk.source, disk.device, disk.target, disk.driver
                )));
            }
        }

        lines
    } else {
        vec![Line::from("No details available")]
    };

    let block = Block::default()
        .borders(Borders::ALL)
        .title(" VM Details (Esc to close) ");
    let paragraph = Paragraph::new(text).block(block).wrap(Wrap { trim: true });
    frame.render_widget(paragraph, area);
}

// ── Help overlay ────────────────────────────────────────────────────────

fn render_help_overlay(frame: &mut Frame, area: Rect) {
    let help_area = centered_rect(60, 80, area);
    frame.render_widget(Clear, help_area);

    let lines = vec![
        Line::from(Span::styled(
            "virtspawn - Keyboard Shortcuts",
            Style::default()
                .fg(Color::Cyan)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from(""),
        Line::from(Span::styled(
            "Navigation",
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from("  j/\u{2193}          Move down"),
        Line::from("  k/\u{2191}          Move up"),
        Line::from("  g             Go to top"),
        Line::from("  G             Go to bottom"),
        Line::from("  Tab           Next view"),
        Line::from("  Shift+Tab     Previous view"),
        Line::from("  1-5           Switch to view"),
        Line::from(""),
        Line::from(Span::styled(
            "VM Actions",
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from("  s             Start VM"),
        Line::from("  x             Stop VM (force)"),
        Line::from("  H             Shutdown VM (graceful)"),
        Line::from("  b             Reboot VM"),
        Line::from("  p             Pause VM"),
        Line::from("  u             Resume VM"),
        Line::from("  d             Delete VM"),
        Line::from("  Enter         Show VM details"),
        Line::from(""),
        Line::from(Span::styled(
            "Network Actions",
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from("  a             Start network"),
        Line::from("  z             Stop network"),
        Line::from(""),
        Line::from(Span::styled(
            "Snapshot Actions",
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from("  R             Revert to snapshot"),
        Line::from("  d             Delete snapshot"),
        Line::from("  :snap <vm> <name>  Create snapshot"),
        Line::from(""),
        Line::from(Span::styled(
            "Sort (VMs)",
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from("  N             Sort by name"),
        Line::from("  S             Sort by state"),
        Line::from("  C             Sort by CPU"),
        Line::from("  M             Sort by memory"),
        Line::from(""),
        Line::from(Span::styled(
            "General",
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from("  /             Search"),
        Line::from("  :             Command mode"),
        Line::from("  r             Refresh"),
        Line::from("  ?/F1          This help"),
        Line::from("  q/Esc         Quit / Close"),
        Line::from(""),
        Line::from(Span::styled(
            "Commands: :vms :net :storage :snap :node :quit",
            Style::default().fg(Color::DarkGray),
        )),
        Line::from(""),
        Line::from(Span::styled(
            "Press any key to close",
            Style::default().fg(Color::DarkGray),
        )),
    ];

    let block = Block::default()
        .borders(Borders::ALL)
        .title(" Help ")
        .style(Style::default().bg(Color::Black));

    let paragraph = Paragraph::new(lines).block(block);
    frame.render_widget(paragraph, help_area);
}

// ── Status bar ──────────────────────────────────────────────────────────

fn render_status_bar(frame: &mut Frame, area: Rect, state: &AppState) {
    let status = Paragraph::new(Line::from(Span::styled(
        &state.status_message,
        Style::default().fg(Color::Cyan),
    )));
    frame.render_widget(status, area);
}

// ── Bottom bar (help hint / search / command) ───────────────────────────

fn render_bottom_bar(frame: &mut Frame, area: Rect, state: &AppState) {
    let line = match state.input_mode {
        InputMode::Search => Line::from(vec![
            Span::styled("/", Style::default().fg(Color::Yellow)),
            Span::raw(&state.search_query),
            Span::styled("\u{2588}", Style::default().fg(Color::White)),
        ]),
        InputMode::Command => Line::from(vec![
            Span::styled(":", Style::default().fg(Color::Yellow)),
            Span::raw(&state.command_input),
            Span::styled("\u{2588}", Style::default().fg(Color::White)),
        ]),
        InputMode::Confirmation => Line::from(Span::styled(
            "Press 'y' to confirm, any other key to cancel",
            Style::default().fg(Color::Red),
        )),
        InputMode::Normal => {
            let help_text = match state.resource_view {
                ResourceView::VirtualMachines => {
                    "?:help  /:search  s:start  x:stop  H:shutdown  b:reboot  p:pause  u:resume  d:delete  r:refresh"
                }
                ResourceView::Networks => {
                    "?:help  /:search  a:start  z:stop  r:refresh"
                }
                ResourceView::StoragePools => {
                    "?:help  /:search  r:refresh"
                }
                ResourceView::Snapshots => {
                    "?:help  /:search  R:revert  d:delete  :snap <vm> <name>  r:refresh"
                }
                ResourceView::Node => {
                    "?:help  r:refresh"
                }
            };
            Line::from(Span::styled(help_text, Style::default().fg(Color::DarkGray)))
        }
    };

    frame.render_widget(Paragraph::new(line), area);
}

// ── Layout helpers ──────────────────────────────────────────────────────

fn centered_rect(percent_x: u16, percent_y: u16, area: Rect) -> Rect {
    let popup_layout = Layout::vertical([
        Constraint::Percentage((100 - percent_y) / 2),
        Constraint::Percentage(percent_y),
        Constraint::Percentage((100 - percent_y) / 2),
    ])
    .split(area);

    Layout::horizontal([
        Constraint::Percentage((100 - percent_x) / 2),
        Constraint::Percentage(percent_x),
        Constraint::Percentage((100 - percent_x) / 2),
    ])
    .split(popup_layout[1])[1]
}
