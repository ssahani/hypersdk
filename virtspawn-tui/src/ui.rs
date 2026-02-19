use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, Cell, Clear, Paragraph, Row, Table, Wrap};
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

    if state.show_context_menu {
        render_context_menu(frame, frame.area(), state);
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

            vec![
                Span::styled(num, style),
                Span::styled(label, style),
                Span::raw("  "),
            ]
        })
        .collect();

    let mut line_spans = tabs;
    if state.multi_select_mode {
        line_spans.push(Span::styled(
            format!(" [{}sel]", state.selected_items.len()),
            Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD),
        ));
    }

    frame.render_widget(Paragraph::new(Line::from(line_spans)), area);
}

// ── Table view dispatch ─────────────────────────────────────────────────

fn render_table_view(frame: &mut Frame, area: Rect, state: &AppState) {
    match state.resource_view {
        ResourceView::VirtualMachines => render_vm_table(frame, area, state),
        ResourceView::Networks => render_network_table(frame, area, state),
        ResourceView::StoragePools => render_storage_table(frame, area, state),
        ResourceView::Snapshots => render_snapshot_table(frame, area, state),
        ResourceView::Events => render_events_table(frame, area, state),
        ResourceView::Node => render_node_view(frame, area, state),
    }
}

// ── VM table ────────────────────────────────────────────────────────────

fn render_vm_table(frame: &mut Frame, area: Rect, state: &AppState) {
    let has_metrics = !state.vm_metrics.is_empty();

    let mut header_cells = vec![
        Cell::from(" "),
        Cell::from("Name"),
        Cell::from("State"),
        Cell::from("vCPUs"),
        Cell::from("Memory (MB)"),
    ];
    if has_metrics {
        header_cells.push(Cell::from("Mem %"));
    }

    let header = Row::new(header_cells).style(
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

            let sel_marker = if state.selected_items.contains(&vm.name) {
                "\u{25cf}" // ●
            } else {
                " "
            };

            let mut cells = vec![
                Cell::from(sel_marker).style(Style::default().fg(Color::Cyan)),
                Cell::from(vm.name.clone()),
                Cell::from(vm.state.clone()).style(Style::default().fg(state_color)),
                Cell::from(vm.vcpus.to_string()),
                Cell::from(vm.memory_mb.to_string()),
            ];

            if has_metrics {
                let pct = state
                    .get_metrics_for_vm(&vm.name)
                    .map(|m| format!("{:.0}%", m.memory_pct))
                    .unwrap_or_else(|| "-".to_string());
                let pct_color = state
                    .get_metrics_for_vm(&vm.name)
                    .map(|m| {
                        if m.memory_pct > 90.0 {
                            Color::Red
                        } else if m.memory_pct > 70.0 {
                            Color::Yellow
                        } else {
                            Color::Green
                        }
                    })
                    .unwrap_or(Color::DarkGray);
                cells.push(Cell::from(pct).style(Style::default().fg(pct_color)));
            }

            let row = Row::new(cells);
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

    let count = if state.filtered_indices.is_empty() {
        state.vms.len()
    } else {
        state.filtered_indices.len()
    };
    let title = format!(" VMs ({count}) ");

    let mut widths = vec![
        Constraint::Length(2),
        Constraint::Percentage(30),
        Constraint::Percentage(15),
        Constraint::Percentage(10),
        Constraint::Percentage(15),
    ];
    if has_metrics {
        widths.push(Constraint::Percentage(10));
    }

    let table = Table::new(rows, widths)
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
                row.style(Style::default().bg(Color::DarkGray).add_modifier(Modifier::BOLD))
            } else {
                row
            }
        })
        .collect();

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
    .block(
        Block::default()
            .borders(Borders::ALL)
            .title(format!(" Networks ({}) ", state.networks.len())),
    );
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
                row.style(Style::default().bg(Color::DarkGray).add_modifier(Modifier::BOLD))
            } else {
                row
            }
        })
        .collect();

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
    .block(
        Block::default()
            .borders(Borders::ALL)
            .title(format!(" Storage Pools ({}) ", state.storage_pools.len())),
    );
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
                row.style(Style::default().bg(Color::DarkGray).add_modifier(Modifier::BOLD))
            } else {
                row
            }
        })
        .collect();

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
    .block(
        Block::default()
            .borders(Borders::ALL)
            .title(format!(" Snapshots ({}) ", state.snapshots.len())),
    );
    frame.render_widget(table, area);
}

// ── Events / Audit table ────────────────────────────────────────────────

fn render_events_table(frame: &mut Frame, area: Rect, state: &AppState) {
    let header = Row::new(vec![
        Cell::from("Time"),
        Cell::from("Action"),
        Cell::from("Target"),
        Cell::from("Result"),
    ])
    .style(
        Style::default()
            .fg(Color::Yellow)
            .add_modifier(Modifier::BOLD),
    );

    // Show most recent first
    let rows: Vec<Row> = state
        .audit_events
        .iter()
        .rev()
        .enumerate()
        .map(|(i, evt)| {
            let result_color = if evt.result.starts_with("ERROR") {
                Color::Red
            } else {
                Color::Green
            };

            let row = Row::new(vec![
                Cell::from(evt.timestamp.clone()),
                Cell::from(evt.action.clone()),
                Cell::from(evt.target.clone()),
                Cell::from(evt.result.clone()).style(Style::default().fg(result_color)),
            ]);
            if i == state.selected_index {
                row.style(Style::default().bg(Color::DarkGray).add_modifier(Modifier::BOLD))
            } else {
                row
            }
        })
        .collect();

    let table = Table::new(
        rows,
        [
            Constraint::Percentage(25),
            Constraint::Percentage(20),
            Constraint::Percentage(30),
            Constraint::Percentage(25),
        ],
    )
    .header(header)
    .block(
        Block::default()
            .borders(Borders::ALL)
            .title(format!(" Events ({}) ", state.audit_events.len())),
    );
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
                Span::styled(node.active_vms.to_string(), Style::default().fg(Color::Green)),
            ]),
            Line::from(vec![
                Span::styled("Defined VMs:    ", Style::default().fg(Color::Yellow)),
                Span::raw(node.defined_vms.to_string()),
            ]),
        ]
    } else {
        vec![Line::from("Loading node info...")]
    };

    let paragraph = Paragraph::new(text)
        .block(Block::default().borders(Borders::ALL).title(" Node Info "));
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

        // Metrics
        if let Some(m) = state.get_metrics_for_vm(&d.name) {
            lines.push(Line::from(""));
            lines.push(Line::from(Span::styled(
                "Metrics:",
                Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD),
            )));
            lines.push(Line::from(format!(
                "  Memory: {} / {} MB ({:.0}%)",
                m.memory_used_mb, m.memory_total_mb, m.memory_pct
            )));
            lines.push(Line::from(format!(
                "  CPU time: {:.2}s",
                m.cpu_time_ns as f64 / 1_000_000_000.0
            )));
        }

        if !d.interfaces.is_empty() {
            lines.push(Line::from(""));
            lines.push(Line::from(Span::styled(
                "Interfaces:",
                Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD),
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
                Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD),
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

    let paragraph = Paragraph::new(text)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title(" VM Details (Esc to close) "),
        )
        .wrap(Wrap { trim: true });
    frame.render_widget(paragraph, area);
}

// ── Context menu overlay ────────────────────────────────────────────────

fn render_context_menu(frame: &mut Frame, area: Rect, state: &AppState) {
    let menu_area = Rect {
        x: area.width / 2 - 15,
        y: area.height / 2 - 7,
        width: 30,
        height: 14,
    };
    frame.render_widget(Clear, menu_area);

    let items = match state.resource_view {
        ResourceView::VirtualMachines => vec![
            "  s  Start",
            "  x  Stop (force)",
            "  h  Shutdown (graceful)",
            "  b  Reboot",
            "  p  Pause",
            "  u  Resume",
            "  d  Delete",
            "  o  Clone",
            "  v  Virt-viewer",
            "  c  Console",
            "  i  Details",
        ],
        ResourceView::Networks => vec!["  a  Start", "  z  Stop"],
        ResourceView::Snapshots => vec!["  R  Revert", "  d  Delete"],
        _ => vec!["  No actions available"],
    };

    let lines: Vec<Line> = items
        .iter()
        .map(|s| Line::from(Span::styled(*s, Style::default().fg(Color::White))))
        .collect();

    let block = Block::default()
        .borders(Borders::ALL)
        .title(" Actions (Esc to close) ")
        .style(Style::default().bg(Color::Black));

    let paragraph = Paragraph::new(lines).block(block);
    frame.render_widget(paragraph, menu_area);
}

// ── Help overlay ────────────────────────────────────────────────────────

fn render_help_overlay(frame: &mut Frame, area: Rect) {
    let help_area = centered_rect(65, 85, area);
    frame.render_widget(Clear, help_area);

    let lines = vec![
        Line::from(Span::styled(
            "virtspawn - Keyboard Shortcuts",
            Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD),
        )),
        Line::from(""),
        section("Navigation"),
        Line::from("  j/\u{2193}  Down    k/\u{2191}  Up    g  Top    G  Bottom"),
        Line::from("  Tab/Shift+Tab  Next/prev view    1-6  Switch view"),
        Line::from(""),
        section("VM Actions"),
        Line::from("  s  Start    x  Stop (force)    H  Shutdown (graceful)"),
        Line::from("  b  Reboot   p  Pause           u  Resume"),
        Line::from("  d  Delete   o  Clone hint      Enter  Details"),
        Line::from("  v  Virt-viewer    c  Console hint"),
        Line::from(""),
        section("Multi-select (VMs)"),
        Line::from("  Space  Toggle select    A  Select all    Esc  Clear"),
        Line::from("  Then s/x/H/b/p/u/d to batch operate"),
        Line::from(""),
        section("Network Actions"),
        Line::from("  a  Start network    z  Stop network"),
        Line::from(""),
        section("Snapshot Actions"),
        Line::from("  R  Revert    d  Delete    :snap <vm> <name>  Create"),
        Line::from(""),
        section("Sort (VMs)"),
        Line::from("  N  Name    S  State    C  CPU    M  Memory"),
        Line::from(""),
        section("General"),
        Line::from("  /  Search    :  Command    r  Refresh    Ctrl+Space  Menu"),
        Line::from("  ?/F1  Help    q/Esc  Quit"),
        Line::from(""),
        section("Commands"),
        Line::from("  :vms :net :storage :snap :events :node :quit"),
        Line::from("  :clone <source> <new-name>    :snap <vm> <name>"),
        Line::from(""),
        Line::from(Span::styled("Press any key to close", Style::default().fg(Color::DarkGray))),
    ];

    let block = Block::default()
        .borders(Borders::ALL)
        .title(" Help ")
        .style(Style::default().bg(Color::Black));

    frame.render_widget(Paragraph::new(lines).block(block), help_area);
}

fn section(title: &str) -> Line<'_> {
    Line::from(Span::styled(
        title,
        Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD),
    ))
}

// ── Status bar ──────────────────────────────────────────────────────────

fn render_status_bar(frame: &mut Frame, area: Rect, state: &AppState) {
    let status = Paragraph::new(Line::from(Span::styled(
        &state.status_message,
        Style::default().fg(Color::Cyan),
    )));
    frame.render_widget(status, area);
}

// ── Bottom bar ──────────────────────────────────────────────────────────

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
                    "?:help /:search s:start x:stop H:shut b:boot p:pause u:resume d:del o:clone v:viewer Space:select"
                }
                ResourceView::Networks => "?:help /:search a:start z:stop r:refresh",
                ResourceView::StoragePools => "?:help /:search r:refresh",
                ResourceView::Snapshots => "?:help /:search R:revert d:delete :snap <vm> <name>",
                ResourceView::Events => "?:help r:refresh",
                ResourceView::Node => "?:help r:refresh",
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
