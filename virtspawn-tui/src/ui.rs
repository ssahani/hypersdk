use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, Cell, Clear, Paragraph, Row, Table, Wrap};
use ratatui::Frame;

use virtspawn_core::{AppState, FormFieldType, InputMode, NotifyLevel, ResourceView, ViewMode};

// ── GuestKit Theme Colors ───────────────────────────────────────────────

const ORANGE: Color = Color::Rgb(222, 115, 86);
const DARK_ORANGE: Color = Color::Rgb(180, 85, 60);
const LIGHT_ORANGE: Color = Color::Rgb(255, 145, 115);
const TEXT_COLOR: Color = Color::Rgb(220, 220, 220);
const BORDER_COLOR: Color = Color::Rgb(180, 85, 60);
const SUCCESS_COLOR: Color = Color::Rgb(50, 205, 50);
const WARNING_COLOR: Color = Color::Rgb(255, 200, 0);
const ERROR_COLOR: Color = Color::Rgb(220, 50, 47);
const INFO_COLOR: Color = Color::Rgb(100, 150, 255);
const HIGHLIGHT_BG: Color = Color::Rgb(60, 40, 20);

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
        ViewMode::Xml => render_xml_view(frame, chunks[1], state),
        ViewMode::Logs => render_log_view(frame, chunks[1], state),
        ViewMode::Help => {
            render_table_view(frame, chunks[1], state);
            render_help_overlay(frame, frame.area());
        }
    }

    if state.show_context_menu {
        render_context_menu(frame, frame.area(), state);
    }

    // Confirmation dialog modal (Phase 2, #5)
    if state.confirm_dialog.is_some() && state.input_mode == InputMode::Confirmation {
        render_confirmation_dialog(frame, frame.area(), state);
    }

    // Create VM dialog modal (Phase 3, #10)
    if state.create_vm_form.is_some() && state.input_mode == InputMode::CreateVmDialog {
        render_create_vm_dialog(frame, frame.area(), state);
    }

    // Notification toast with icons (Phase 1, #3)
    if let Some((ref msg, ref when, ref level)) = state.notification {
        if when.elapsed().as_secs() < 3 {
            render_notification(frame, frame.area(), msg, *level);
        }
    }

    render_status_bar(frame, chunks[2], state);
    render_bottom_bar(frame, chunks[3], state);
}

// ── Tab bar with resource counts (Phase 1, #1) ─────────────────────────

fn render_tab_bar(frame: &mut Frame, area: Rect, state: &AppState) {
    let icons = ["\u{1F5A5}", "\u{1F310}", "\u{1F4BE}", "\u{1F4F8}", "\u{1F4CB}", "\u{2699}"];
    let wide_enough = area.width >= 100;

    let mut spans: Vec<Span> = vec![
        Span::styled(" \u{26A1} ", Style::default().fg(ORANGE).add_modifier(Modifier::BOLD)),
        Span::styled("virtspawn", Style::default().fg(LIGHT_ORANGE).add_modifier(Modifier::BOLD)),
        Span::styled(" \u{2502} ", Style::default().fg(DARK_ORANGE)),
    ];

    for (i, view) in ResourceView::all().iter().enumerate() {
        let icon = icons.get(i).unwrap_or(&"");
        let is_active = *view == state.resource_view;

        // Build label with counts when terminal is wide enough
        let label = if wide_enough {
            match view {
                ResourceView::VirtualMachines => {
                    let running = state.vms.iter().filter(|v| v.state == "running").count();
                    let total = state.vms.len();
                    format!(" {icon} VMs ({running}/{total}) ")
                }
                ResourceView::Networks => {
                    format!(" {icon} Networks ({}) ", state.networks.len())
                }
                ResourceView::StoragePools => {
                    format!(" {icon} Storage ({}) ", state.storage_pools.len())
                }
                ResourceView::Snapshots => {
                    format!(" {icon} Snapshots ({}) ", state.snapshots.len())
                }
                ResourceView::Events => {
                    format!(" {icon} Events ({}) ", state.audit_events.len())
                }
                ResourceView::Node => {
                    format!(" {icon} Node ")
                }
            }
        } else {
            format!(" {icon} {} ", view.label())
        };

        if is_active {
            spans.push(Span::styled(
                label,
                Style::default()
                    .fg(Color::Black)
                    .bg(ORANGE)
                    .add_modifier(Modifier::BOLD),
            ));
        } else {
            spans.push(Span::styled(label, Style::default().fg(TEXT_COLOR)));
        }
    }

    // Connection indicator
    let (conn_text, conn_color) = if state.connected {
        (" \u{25cf} ", SUCCESS_COLOR)
    } else {
        (" \u{25cb} ", ERROR_COLOR)
    };
    spans.push(Span::styled(conn_text, Style::default().fg(conn_color)));

    if state.multi_select_mode {
        spans.push(Span::styled(
            format!("[{}sel]", state.selected_items.len()),
            Style::default().fg(WARNING_COLOR).add_modifier(Modifier::BOLD),
        ));
    }

    frame.render_widget(Paragraph::new(Line::from(spans)), area);
}

// ── Table view dispatch ─────────────────────────────────────────────────

fn render_table_view(frame: &mut Frame, area: Rect, state: &AppState) {
    match state.resource_view {
        ResourceView::VirtualMachines => render_vm_table(frame, area, state),
        ResourceView::Networks => render_network_table(frame, area, state),
        ResourceView::StoragePools => {
            if state.browsing_pool.is_some() {
                // Breadcrumb navigation (Phase 1, #4)
                let chunks = Layout::vertical([
                    Constraint::Length(1), // Breadcrumb
                    Constraint::Min(0),    // Table
                ])
                .split(area);
                render_breadcrumb(frame, chunks[0], state);
                render_volume_table(frame, chunks[1], state);
            } else {
                render_storage_table(frame, area, state);
            }
        }
        ResourceView::Snapshots => render_snapshot_table(frame, area, state),
        ResourceView::Events => render_events_table(frame, area, state),
        ResourceView::Node => render_node_view(frame, area, state),
    }
}

// ── Breadcrumb navigation (Phase 1, #4) ─────────────────────────────────

fn render_breadcrumb(frame: &mut Frame, area: Rect, state: &AppState) {
    let pool_name = state.browsing_pool.as_deref().unwrap_or("?");
    let line = Line::from(vec![
        Span::styled(" Storage", Style::default().fg(DARK_ORANGE)),
        Span::styled(" \u{203a} ", Style::default().fg(ORANGE).add_modifier(Modifier::BOLD)),
        Span::styled(pool_name, Style::default().fg(LIGHT_ORANGE).add_modifier(Modifier::BOLD)),
        Span::styled(" \u{203a} ", Style::default().fg(ORANGE).add_modifier(Modifier::BOLD)),
        Span::styled("Volumes", Style::default().fg(TEXT_COLOR)),
    ]);
    frame.render_widget(Paragraph::new(line), area);
}

// ── Themed block helper ─────────────────────────────────────────────────

fn themed_block(title: String) -> Block<'static> {
    Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(BORDER_COLOR))
        .title(title)
        .title_style(Style::default().fg(ORANGE).add_modifier(Modifier::BOLD))
}

fn header_style() -> Style {
    Style::default().fg(ORANGE).add_modifier(Modifier::BOLD)
}

fn selected_style() -> Style {
    Style::default()
        .fg(LIGHT_ORANGE)
        .add_modifier(Modifier::BOLD)
}

fn state_color(state: &str) -> Color {
    match state {
        "running" => SUCCESS_COLOR,
        "shutoff" => ERROR_COLOR,
        "paused" => WARNING_COLOR,
        "crashed" => Color::Rgb(200, 50, 200),
        "inactive" => ERROR_COLOR,
        _ => Color::Rgb(150, 150, 150),
    }
}

// ── VM table with responsive columns (#7), state highlights (#6), sparklines (#9) ──

fn render_vm_table(frame: &mut Frame, area: Rect, state: &AppState) {
    let has_metrics = !state.vm_metrics.is_empty();
    let w = area.width;
    let show_vcpus_mem = w >= 60;
    let show_metrics = has_metrics && w >= 80;
    let show_trend = has_metrics && w > 120 && !state.metrics_history.is_empty();
    let show_uuid = w > 160;

    // Build header
    let mut header_cells = vec![
        Cell::from(" "),
        Cell::from("Name"),
        Cell::from("State"),
    ];
    if show_vcpus_mem {
        header_cells.push(Cell::from("vCPUs"));
        header_cells.push(Cell::from("Memory (MB)"));
    }
    if show_metrics {
        header_cells.push(Cell::from("Mem %"));
    }
    if show_trend {
        header_cells.push(Cell::from("Trend"));
    }
    if show_uuid {
        header_cells.push(Cell::from("Autostart"));
    }

    let header = Row::new(header_cells)
        .style(header_style())
        .bottom_margin(1);

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
            let sc = state_color(&vm.state);

            let sel_marker = if state.selected_items.contains(&vm.name) {
                "\u{2611}" // ☑
            } else {
                " "
            };

            let mut cells = vec![
                Cell::from(sel_marker).style(Style::default().fg(ORANGE)),
                Cell::from(vm.name.clone()).style(Style::default().fg(LIGHT_ORANGE)),
                Cell::from(vm.state.clone()).style(Style::default().fg(sc)),
            ];

            if show_vcpus_mem {
                cells.push(Cell::from(vm.vcpus.to_string()).style(Style::default().fg(TEXT_COLOR)));
                cells.push(Cell::from(vm.memory_mb.to_string()).style(Style::default().fg(TEXT_COLOR)));
            }

            if show_metrics {
                if let Some(m) = state.get_metrics_for_vm(&vm.name) {
                    let bar = format!("{:.0}% {}", m.memory_pct, memory_bar(m.memory_pct));
                    let pct_color = if m.memory_pct > 90.0 { ERROR_COLOR }
                        else if m.memory_pct > 70.0 { WARNING_COLOR }
                        else { SUCCESS_COLOR };
                    cells.push(Cell::from(bar).style(Style::default().fg(pct_color)));
                } else {
                    cells.push(Cell::from("-").style(Style::default().fg(Color::DarkGray)));
                }
            }

            if show_trend {
                if let Some(history) = state.metrics_history.get(&vm.name) {
                    cells.push(Cell::from(mini_sparkline(history)).style(Style::default().fg(INFO_COLOR)));
                } else {
                    cells.push(Cell::from("-").style(Style::default().fg(Color::DarkGray)));
                }
            }

            if show_uuid {
                cells.push(Cell::from("-").style(Style::default().fg(Color::DarkGray)));
            }

            let row = Row::new(cells);

            // State transition highlight (Phase 2, #6)
            if state.state_changed_vms.contains_key(&vm.name) {
                row.style(Style::default().fg(LIGHT_ORANGE).bg(HIGHLIGHT_BG).add_modifier(Modifier::BOLD))
            } else if display_idx == state.selected_index {
                row.style(selected_style())
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

    let running = state.vms.iter().filter(|v| v.state == "running").count();

    // Build widths based on visible columns
    let mut widths: Vec<Constraint> = vec![
        Constraint::Length(2),
        Constraint::Percentage(if show_uuid { 20 } else { 30 }),
        Constraint::Percentage(15),
    ];
    if show_vcpus_mem {
        widths.push(Constraint::Percentage(8));
        widths.push(Constraint::Percentage(12));
    }
    if show_metrics {
        widths.push(Constraint::Percentage(15));
    }
    if show_trend {
        widths.push(Constraint::Percentage(12));
    }
    if show_uuid {
        widths.push(Constraint::Percentage(8));
    }

    let table = Table::new(rows, widths)
        .header(header)
        .column_spacing(2)
        .block(themed_block(format!(" VMs ({running}/{count}) ")));

    frame.render_widget(table, area);
}

// ── Network table (responsive) ──────────────────────────────────────────

fn render_network_table(frame: &mut Frame, area: Rect, state: &AppState) {
    let w = area.width;
    let show_extra = w >= 80;

    let mut hdr = vec![
        Cell::from("Name"),
        Cell::from("Active"),
        Cell::from("Autostart"),
    ];
    if show_extra {
        hdr.push(Cell::from("Bridge"));
        hdr.push(Cell::from("Persistent"));
    }
    let header = Row::new(hdr).style(header_style()).bottom_margin(1);

    let rows: Vec<Row> = state
        .networks
        .iter()
        .enumerate()
        .map(|(i, net)| {
            let active_color = if net.active { SUCCESS_COLOR } else { ERROR_COLOR };
            let mut cells = vec![
                Cell::from(net.name.clone()).style(Style::default().fg(LIGHT_ORANGE)),
                Cell::from(if net.active { "yes" } else { "no" })
                    .style(Style::default().fg(active_color)),
                Cell::from(if net.autostart { "yes" } else { "no" }).style(Style::default().fg(TEXT_COLOR)),
            ];
            if show_extra {
                cells.push(Cell::from(net.bridge.clone()).style(Style::default().fg(TEXT_COLOR)));
                cells.push(Cell::from(if net.persistent { "yes" } else { "no" }).style(Style::default().fg(TEXT_COLOR)));
            }
            let row = Row::new(cells);
            if i == state.selected_index { row.style(selected_style()) } else { row }
        })
        .collect();

    let mut widths: Vec<Constraint> = vec![
        Constraint::Percentage(30),
        Constraint::Percentage(15),
        Constraint::Percentage(15),
    ];
    if show_extra {
        widths.push(Constraint::Percentage(25));
        widths.push(Constraint::Percentage(15));
    }

    let active = state.networks.iter().filter(|n| n.active).count();
    let table = Table::new(rows, widths)
        .header(header)
        .column_spacing(2)
        .block(themed_block(format!(" Networks ({}/{}) ", active, state.networks.len())));
    frame.render_widget(table, area);
}

// ── Storage table (responsive) ──────────────────────────────────────────

fn render_storage_table(frame: &mut Frame, area: Rect, state: &AppState) {
    let w = area.width;
    let show_autostart = w >= 80;

    let mut hdr = vec![
        Cell::from("Name"), Cell::from("State"), Cell::from("Capacity (GB)"),
        Cell::from("Used (GB)"), Cell::from("Available (GB)"),
    ];
    if show_autostart {
        hdr.push(Cell::from("Autostart"));
    }
    let header = Row::new(hdr).style(header_style()).bottom_margin(1);

    let rows: Vec<Row> = state
        .storage_pools
        .iter()
        .enumerate()
        .map(|(i, pool)| {
            let sc = state_color(&pool.state);
            let mut cells = vec![
                Cell::from(pool.name.clone()).style(Style::default().fg(LIGHT_ORANGE)),
                Cell::from(pool.state.clone()).style(Style::default().fg(sc)),
                Cell::from(format!("{:.1}", pool.capacity_gb)).style(Style::default().fg(TEXT_COLOR)),
                Cell::from(format!("{:.1}", pool.allocation_gb)).style(Style::default().fg(TEXT_COLOR)),
                Cell::from(format!("{:.1}", pool.available_gb)).style(Style::default().fg(SUCCESS_COLOR)),
            ];
            if show_autostart {
                cells.push(Cell::from(if pool.autostart { "yes" } else { "no" }).style(Style::default().fg(TEXT_COLOR)));
            }
            let row = Row::new(cells);
            if i == state.selected_index { row.style(selected_style()) } else { row }
        })
        .collect();

    let mut widths: Vec<Constraint> = vec![
        Constraint::Percentage(20), Constraint::Percentage(15),
        Constraint::Percentage(18), Constraint::Percentage(15),
        Constraint::Percentage(18),
    ];
    if show_autostart {
        widths.push(Constraint::Percentage(14));
    }

    let table = Table::new(rows, widths)
        .header(header)
        .column_spacing(2)
        .block(themed_block(format!(" Storage Pools ({}) ", state.storage_pools.len())));
    frame.render_widget(table, area);
}

// ── Snapshot table ──────────────────────────────────────────────────────

fn render_snapshot_table(frame: &mut Frame, area: Rect, state: &AppState) {
    let header = Row::new(vec![
        Cell::from("VM"), Cell::from("Snapshot"), Cell::from("State"),
        Cell::from("Current"), Cell::from("Parent"),
    ])
    .style(header_style())
    .bottom_margin(1);

    let rows: Vec<Row> = state
        .snapshots
        .iter()
        .enumerate()
        .map(|(i, snap)| {
            let row = Row::new(vec![
                Cell::from(snap.vm_name.clone()).style(Style::default().fg(LIGHT_ORANGE)),
                Cell::from(snap.name.clone()).style(Style::default().fg(TEXT_COLOR)),
                Cell::from(snap.state.clone()).style(Style::default().fg(TEXT_COLOR)),
                Cell::from(if snap.is_current { "\u{25cf}" } else { "" })
                    .style(Style::default().fg(SUCCESS_COLOR)),
                Cell::from(snap.parent.clone()).style(Style::default().fg(Color::DarkGray)),
            ]);
            if i == state.selected_index { row.style(selected_style()) } else { row }
        })
        .collect();

    let table = Table::new(
        rows,
        [
            Constraint::Percentage(25), Constraint::Percentage(25),
            Constraint::Percentage(20), Constraint::Percentage(10),
            Constraint::Percentage(20),
        ],
    )
    .header(header)
    .column_spacing(2)
    .block(themed_block(format!(" Snapshots ({}) ", state.snapshots.len())));
    frame.render_widget(table, area);
}

// ── Events / Audit table ────────────────────────────────────────────────

fn render_events_table(frame: &mut Frame, area: Rect, state: &AppState) {
    let header = Row::new(vec![
        Cell::from("Time"), Cell::from("Action"),
        Cell::from("Target"), Cell::from("Result"),
    ])
    .style(header_style())
    .bottom_margin(1);

    let rows: Vec<Row> = state
        .audit_events
        .iter()
        .rev()
        .enumerate()
        .map(|(i, evt)| {
            let result_color = if evt.result.starts_with("ERROR") { ERROR_COLOR } else { SUCCESS_COLOR };
            let row = Row::new(vec![
                Cell::from(evt.timestamp.clone()).style(Style::default().fg(Color::DarkGray)),
                Cell::from(evt.action.clone()).style(Style::default().fg(LIGHT_ORANGE)),
                Cell::from(evt.target.clone()).style(Style::default().fg(TEXT_COLOR)),
                Cell::from(evt.result.clone()).style(Style::default().fg(result_color)),
            ]);
            if i == state.selected_index { row.style(selected_style()) } else { row }
        })
        .collect();

    let table = Table::new(
        rows,
        [
            Constraint::Percentage(25), Constraint::Percentage(20),
            Constraint::Percentage(30), Constraint::Percentage(25),
        ],
    )
    .header(header)
    .column_spacing(2)
    .block(themed_block(format!(" Events ({}) ", state.audit_events.len())));
    frame.render_widget(table, area);
}

// ── Node view ───────────────────────────────────────────────────────────

fn render_node_view(frame: &mut Frame, area: Rect, state: &AppState) {
    let chunks = Layout::vertical([
        Constraint::Length(5),  // Dashboard summary
        Constraint::Min(0),    // Node details
    ])
    .split(area);

    // Dashboard summary bar
    let d = &state.dashboard;
    let dash_lines = vec![
        Line::from(vec![
            Span::styled(" VMs: ", Style::default().fg(ORANGE).add_modifier(Modifier::BOLD)),
            Span::styled(format!("{} total", d.total_vms), Style::default().fg(TEXT_COLOR)),
            Span::raw("  "),
            Span::styled(format!("{} running", d.running_vms), Style::default().fg(SUCCESS_COLOR).add_modifier(Modifier::BOLD)),
            Span::raw("  "),
            Span::styled(format!("{} stopped", d.stopped_vms), Style::default().fg(ERROR_COLOR)),
            if d.paused_vms > 0 {
                Span::styled(format!("  {} paused", d.paused_vms), Style::default().fg(WARNING_COLOR))
            } else {
                Span::raw("")
            },
        ]),
        Line::from(vec![
            Span::styled(" CPU: ", Style::default().fg(ORANGE).add_modifier(Modifier::BOLD)),
            Span::styled(format!("{} vCPUs allocated", d.total_vcpus), Style::default().fg(TEXT_COLOR)),
            Span::raw("    "),
            Span::styled("Memory: ", Style::default().fg(ORANGE).add_modifier(Modifier::BOLD)),
            Span::styled(format!("{} MB allocated", d.total_memory_mb), Style::default().fg(TEXT_COLOR)),
        ]),
        Line::from(vec![
            Span::styled(" Net: ", Style::default().fg(ORANGE).add_modifier(Modifier::BOLD)),
            Span::styled(format!("{}/{} active", d.active_networks, d.total_networks), Style::default().fg(INFO_COLOR)),
            Span::raw("    "),
            Span::styled("Storage: ", Style::default().fg(ORANGE).add_modifier(Modifier::BOLD)),
            Span::styled(format!("{}/{} active", d.active_pools, d.total_pools), Style::default().fg(INFO_COLOR)),
            Span::raw("    "),
            Span::styled("Snapshots: ", Style::default().fg(ORANGE).add_modifier(Modifier::BOLD)),
            Span::styled(d.total_snapshots.to_string(), Style::default().fg(TEXT_COLOR)),
        ]),
    ];

    let dash = Paragraph::new(dash_lines)
        .style(Style::default().fg(TEXT_COLOR))
        .block(themed_block(" Dashboard ".to_string()));
    frame.render_widget(dash, chunks[0]);

    // Node details
    let text = if let Some(ref node) = state.node_info {
        vec![
            kv_line("Hostname:       ", &node.hostname),
            kv_line("Hypervisor:     ", &format!("{} {}", node.hypervisor, node.hypervisor_version)),
            kv_line("Libvirt:        ", &node.lib_version),
            Line::from(""),
            kv_line("CPU Model:      ", &node.cpu_model),
            kv_line("CPU Layout:     ", &format!(
                "{} socket(s) x {} core(s) x {} thread(s)",
                node.cpu_sockets, node.cpu_cores, node.cpu_threads
            )),
            kv_line("NUMA Nodes:     ", &node.numa_nodes.to_string()),
            Line::from(""),
            kv_line("Total Memory:   ", &format!("{} MB ({:.1} GB)", node.memory_mb, node.memory_mb as f64 / 1024.0)),
        ]
    } else {
        vec![Line::from(Span::styled("Loading node info...", Style::default().fg(TEXT_COLOR)))]
    };

    let paragraph = Paragraph::new(text)
        .style(Style::default().fg(TEXT_COLOR))
        .block(themed_block(" Node Info ".to_string()));
    frame.render_widget(paragraph, chunks[1]);
}

fn kv_line(key: &str, value: &str) -> Line<'static> {
    Line::from(vec![
        Span::styled(key.to_string(), Style::default().fg(ORANGE)),
        Span::styled(value.to_string(), Style::default().fg(TEXT_COLOR)),
    ])
}

// ── Details view ────────────────────────────────────────────────────────

fn render_details_view(frame: &mut Frame, area: Rect, state: &AppState) {
    let text = if let Some(ref d) = state.vm_details {
        let mut lines = vec![
            kv_line("Name:        ", &d.name),
            kv_line("UUID:        ", &d.uuid),
            Line::from(vec![
                Span::styled("State:       ", Style::default().fg(ORANGE)),
                Span::styled(&d.state, Style::default().fg(state_color(&d.state)).add_modifier(Modifier::BOLD)),
            ]),
            kv_line("vCPUs:       ", &d.vcpus.to_string()),
            kv_line("Memory:      ", &format!("{} MB", d.memory_mb)),
            kv_line("OS Type:     ", &d.os_type),
            kv_line("Arch:        ", &d.arch),
            kv_line("Persistent:  ", if d.persistent { "yes" } else { "no" }),
            kv_line("Autostart:   ", if d.autostart { "yes" } else { "no" }),
        ];

        if let Some(m) = state.get_metrics_for_vm(&d.name) {
            lines.push(Line::from(""));
            lines.push(section_header("Metrics"));
            lines.push(Line::from(Span::styled(
                format!("  Memory: {} / {} MB ({:.0}%)", m.memory_used_mb, m.memory_total_mb, m.memory_pct),
                Style::default().fg(TEXT_COLOR),
            )));
            lines.push(Line::from(Span::styled(
                format!("  CPU time: {:.2}s", m.cpu_time_ns as f64 / 1_000_000_000.0),
                Style::default().fg(TEXT_COLOR),
            )));
            if m.disk_rd_bytes > 0 || m.disk_wr_bytes > 0 {
                lines.push(Line::from(Span::styled(
                    format!("  Disk I/O: read {}, written {}", format_bytes(m.disk_rd_bytes), format_bytes(m.disk_wr_bytes)),
                    Style::default().fg(TEXT_COLOR),
                )));
            }
            if m.net_rx_bytes > 0 || m.net_tx_bytes > 0 {
                lines.push(Line::from(Span::styled(
                    format!("  Network: RX {}, TX {}", format_bytes(m.net_rx_bytes), format_bytes(m.net_tx_bytes)),
                    Style::default().fg(TEXT_COLOR),
                )));
            }
        }

        if !d.interfaces.is_empty() {
            lines.push(Line::from(""));
            lines.push(section_header("Interfaces"));
            for iface in &d.interfaces {
                lines.push(Line::from(Span::styled(
                    format!("  MAC: {}  Source: {}  Model: {}", iface.mac_address, iface.source, iface.model),
                    Style::default().fg(TEXT_COLOR),
                )));
            }
        }

        if !d.disks.is_empty() {
            lines.push(Line::from(""));
            lines.push(section_header("Disks"));
            for disk in &d.disks {
                lines.push(Line::from(Span::styled(
                    format!("  {} ({})  Target: {}  Driver: {}", disk.source, disk.device, disk.target, disk.driver),
                    Style::default().fg(TEXT_COLOR),
                )));
            }
        }

        lines
    } else {
        vec![Line::from("No details available")]
    };

    let paragraph = Paragraph::new(text)
        .style(Style::default().fg(TEXT_COLOR))
        .block(themed_block(" VM Details (Esc to close) ".to_string()))
        .wrap(Wrap { trim: true });
    frame.render_widget(paragraph, area);
}

fn section_header(title: &str) -> Line<'static> {
    Line::from(Span::styled(
        title.to_string(),
        Style::default().fg(LIGHT_ORANGE).add_modifier(Modifier::BOLD | Modifier::UNDERLINED),
    ))
}

// ── Volume table (inside pool browser) ──────────────────────────────────

fn render_volume_table(frame: &mut Frame, area: Rect, state: &AppState) {
    let pool_name = state.browsing_pool.as_deref().unwrap_or("?");

    let header = Row::new(vec![
        Cell::from("Name"), Cell::from("Type"), Cell::from("Capacity (GB)"),
        Cell::from("Used (GB)"), Cell::from("Path"),
    ])
    .style(header_style())
    .bottom_margin(1);

    let rows: Vec<Row> = state
        .volumes
        .iter()
        .enumerate()
        .map(|(i, vol)| {
            let row = Row::new(vec![
                Cell::from(vol.name.clone()).style(Style::default().fg(LIGHT_ORANGE)),
                Cell::from(vol.vol_type.clone()).style(Style::default().fg(TEXT_COLOR)),
                Cell::from(format!("{:.1}", vol.capacity_gb)).style(Style::default().fg(TEXT_COLOR)),
                Cell::from(format!("{:.1}", vol.allocation_gb)).style(Style::default().fg(TEXT_COLOR)),
                Cell::from(vol.path.clone()).style(Style::default().fg(Color::DarkGray)),
            ]);
            if i == state.selected_index { row.style(selected_style()) } else { row }
        })
        .collect();

    let table = Table::new(
        rows,
        [
            Constraint::Percentage(20), Constraint::Percentage(10),
            Constraint::Percentage(15), Constraint::Percentage(15),
            Constraint::Percentage(40),
        ],
    )
    .header(header)
    .column_spacing(2)
    .block(themed_block(format!(" Volumes in '{}' ({}) - Backspace to go back ", pool_name, state.volumes.len())));
    frame.render_widget(table, area);
}

// ── Log view ────────────────────────────────────────────────────────────

fn render_log_view(frame: &mut Frame, area: Rect, state: &AppState) {
    let lines: Vec<Line> = state
        .log_content
        .lines()
        .map(|l| {
            let style = if l.starts_with("\u{2500}\u{2500}") || l.starts_with("──") {
                Style::default().fg(ORANGE).add_modifier(Modifier::BOLD)
            } else if l.contains("error") || l.contains("ERROR") || l.contains("fail") {
                Style::default().fg(ERROR_COLOR)
            } else if l.contains("warn") || l.contains("WARN") {
                Style::default().fg(WARNING_COLOR)
            } else {
                Style::default().fg(TEXT_COLOR)
            };
            Line::from(Span::styled(l.to_string(), style))
        })
        .collect();

    let paragraph = Paragraph::new(lines)
        .block(themed_block(" Logs (j/k:scroll  Esc:close) ".to_string()))
        .scroll((state.scroll_offset, 0));

    frame.render_widget(paragraph, area);
}

// ── Notification toast with icons (Phase 1, #3) ─────────────────────────

fn render_notification(frame: &mut Frame, area: Rect, msg: &str, level: NotifyLevel) {
    let (icon, color, border_color) = match level {
        NotifyLevel::Success => ("\u{2713} ", SUCCESS_COLOR, SUCCESS_COLOR),
        NotifyLevel::Error   => ("\u{2717} ", ERROR_COLOR, ERROR_COLOR),
        NotifyLevel::Warning => ("\u{26a0} ", WARNING_COLOR, WARNING_COLOR),
        NotifyLevel::Info    => ("\u{2139} ", INFO_COLOR, INFO_COLOR),
    };

    let display = format!("{icon}{msg}");
    let width = (display.len() as u16 + 4).min(area.width - 4);
    let x = area.width.saturating_sub(width + 2);
    let toast_area = Rect { x, y: 1, width, height: 3 };

    frame.render_widget(Clear, toast_area);

    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(border_color).add_modifier(Modifier::BOLD))
        .style(Style::default().bg(Color::Black));

    let paragraph = Paragraph::new(Line::from(Span::styled(
        display,
        Style::default().fg(color).add_modifier(Modifier::BOLD),
    )))
    .block(block);

    frame.render_widget(paragraph, toast_area);
}

// ── Memory bar helper with Unicode blocks (Phase 3, #9) ─────────────────

fn memory_bar(pct: f64) -> String {
    const BLOCKS: [char; 8] = ['\u{2581}', '\u{2582}', '\u{2583}', '\u{2584}', '\u{2585}', '\u{2586}', '\u{2587}', '\u{2588}'];
    let filled = (pct / 10.0).round() as usize;
    let bar: String = (0..10)
        .map(|i| {
            if i < filled {
                let level = ((pct / 100.0) * 7.0).round() as usize;
                BLOCKS[level.min(7)]
            } else {
                '\u{2581}'
            }
        })
        .collect();
    bar
}

// ── Mini sparkline for trend column (Phase 3, #9) ───────────────────────

fn mini_sparkline(values: &[f64]) -> String {
    const BLOCKS: [char; 8] = ['\u{2581}', '\u{2582}', '\u{2583}', '\u{2584}', '\u{2585}', '\u{2586}', '\u{2587}', '\u{2588}'];
    if values.is_empty() {
        return String::new();
    }

    let min = values.iter().cloned().fold(f64::INFINITY, f64::min);
    let max = values.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let range = if (max - min).abs() < 0.01 { 1.0 } else { max - min };

    values
        .iter()
        .map(|&v| {
            let normalized = ((v - min) / range * 7.0).round() as usize;
            BLOCKS[normalized.min(7)]
        })
        .collect()
}

// ── XML view ────────────────────────────────────────────────────────────

fn render_xml_view(frame: &mut Frame, area: Rect, state: &AppState) {
    let lines: Vec<Line> = state
        .xml_content
        .lines()
        .map(|l| {
            let style = if l.trim_start().starts_with('<') && l.contains("</") {
                Style::default().fg(TEXT_COLOR)
            } else if l.trim_start().starts_with('<') {
                Style::default().fg(LIGHT_ORANGE)
            } else {
                Style::default().fg(Color::DarkGray)
            };
            Line::from(Span::styled(l, style))
        })
        .collect();

    let paragraph = Paragraph::new(lines)
        .block(themed_block(" XML (j/k:scroll  Esc:close) ".to_string()))
        .scroll((state.scroll_offset, 0));

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
            ("s", "Start"), ("x", "Stop (force)"), ("h", "Shutdown"),
            ("b", "Reboot"), ("p", "Pause"), ("u", "Resume"),
            ("d", "Delete"), ("o", "Clone"), ("v", "Virt-viewer"),
            ("c", "Console"), ("i", "Details"), ("n", "New VM"),
        ],
        ResourceView::Networks => vec![("a", "Start"), ("z", "Stop")],
        ResourceView::Snapshots => vec![("R", "Revert"), ("d", "Delete")],
        _ => vec![],
    };

    let lines: Vec<Line> = items
        .iter()
        .map(|(key, desc)| {
            Line::from(vec![
                Span::styled(format!("  {key}  "), Style::default().fg(ORANGE).add_modifier(Modifier::BOLD)),
                Span::styled(*desc, Style::default().fg(TEXT_COLOR)),
            ])
        })
        .collect();

    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(ORANGE))
        .title(" Actions ")
        .title_style(Style::default().fg(ORANGE).add_modifier(Modifier::BOLD))
        .style(Style::default().bg(Color::Black));

    frame.render_widget(Paragraph::new(lines).block(block), menu_area);
}

// ── Confirmation dialog modal (Phase 2, #5) ─────────────────────────────

fn render_confirmation_dialog(frame: &mut Frame, area: Rect, state: &AppState) {
    if let Some(ref dialog) = state.confirm_dialog {
        let dialog_area = centered_rect(50, 30, area);
        frame.render_widget(Clear, dialog_area);

        let lines = vec![
            Line::from(""),
            Line::from(Span::styled(
                &dialog.resource_name,
                Style::default().fg(LIGHT_ORANGE).add_modifier(Modifier::BOLD),
            )),
            Line::from(""),
            Line::from(Span::styled(
                &dialog.message,
                Style::default().fg(TEXT_COLOR),
            )),
            Line::from(""),
            Line::from(vec![
                Span::styled("  [y] ", Style::default().fg(ERROR_COLOR).add_modifier(Modifier::BOLD)),
                Span::styled("Confirm", Style::default().fg(TEXT_COLOR)),
                Span::raw("    "),
                Span::styled("[n] ", Style::default().fg(SUCCESS_COLOR).add_modifier(Modifier::BOLD)),
                Span::styled("Cancel", Style::default().fg(TEXT_COLOR)),
            ]),
        ];

        let block = Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(ERROR_COLOR).add_modifier(Modifier::BOLD))
            .title(format!(" {} ", dialog.title))
            .title_style(Style::default().fg(ERROR_COLOR).add_modifier(Modifier::BOLD))
            .style(Style::default().bg(Color::Black));

        frame.render_widget(Paragraph::new(lines).block(block), dialog_area);
    }
}

// ── Create VM dialog (Phase 3, #10) ─────────────────────────────────────

fn render_create_vm_dialog(frame: &mut Frame, area: Rect, state: &AppState) {
    if let Some(ref form) = state.create_vm_form {
        let dialog_area = centered_rect(55, 65, area);
        frame.render_widget(Clear, dialog_area);

        let mut lines = vec![
            Line::from(""),
        ];

        for (i, field) in form.fields.iter().enumerate() {
            let is_focused = i == form.focused_field;
            let label_style = if is_focused {
                Style::default().fg(ORANGE).add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(DARK_ORANGE)
            };

            let value_str = if field.field_type == FormFieldType::TemplateSelect {
                let tmpl_display = if is_focused {
                    format!("\u{25c0} {} \u{25b6}", field.value)
                } else {
                    field.value.clone()
                };
                tmpl_display
            } else if is_focused {
                format!("{}_", field.value)
            } else {
                field.value.clone()
            };

            let value_style = if is_focused {
                Style::default().fg(TEXT_COLOR).add_modifier(Modifier::UNDERLINED)
            } else {
                Style::default().fg(Color::DarkGray)
            };

            let mut spans = vec![
                Span::styled(format!("  {:>12}: ", field.label), label_style),
                Span::styled(value_str, value_style),
            ];

            if let Some(ref err) = field.validation_error {
                spans.push(Span::styled(format!("  \u{2717} {err}"), Style::default().fg(ERROR_COLOR)));
            }

            lines.push(Line::from(spans));
            lines.push(Line::from("")); // spacing between fields
        }

        lines.push(Line::from(vec![
            Span::styled("  Tab", Style::default().fg(ORANGE).add_modifier(Modifier::BOLD)),
            Span::styled(":next field  ", Style::default().fg(DARK_ORANGE)),
            Span::styled("\u{2190}\u{2192}", Style::default().fg(ORANGE).add_modifier(Modifier::BOLD)),
            Span::styled(":template  ", Style::default().fg(DARK_ORANGE)),
            Span::styled("Enter", Style::default().fg(ORANGE).add_modifier(Modifier::BOLD)),
            Span::styled(":create  ", Style::default().fg(DARK_ORANGE)),
            Span::styled("Esc", Style::default().fg(ORANGE).add_modifier(Modifier::BOLD)),
            Span::styled(":cancel", Style::default().fg(DARK_ORANGE)),
        ]));

        let block = Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(ORANGE).add_modifier(Modifier::BOLD))
            .title(" Create VM ")
            .title_style(Style::default().fg(ORANGE).add_modifier(Modifier::BOLD))
            .style(Style::default().bg(Color::Black));

        frame.render_widget(Paragraph::new(lines).block(block), dialog_area);
    }
}

// ── Help overlay ────────────────────────────────────────────────────────

fn render_help_overlay(frame: &mut Frame, area: Rect) {
    let help_area = centered_rect(65, 85, area);
    frame.render_widget(Clear, help_area);

    let lines = vec![
        Line::from(Span::styled(
            "virtspawn - Keyboard Shortcuts",
            Style::default().fg(ORANGE).add_modifier(Modifier::BOLD),
        )),
        Line::from(""),
        help_section("Navigation"),
        help_line("j/\u{2193}  Down    k/\u{2191}  Up    g  Top    G  Bottom"),
        help_line("Tab/Shift+Tab  Next/prev view    1-6  Switch view"),
        Line::from(""),
        help_section("VM Actions"),
        help_line("s  Start    x  Stop (force)    H  Shutdown (graceful)"),
        help_line("b  Reboot   p  Pause           u  Resume"),
        help_line("d  Delete   o  Clone hint      t  Toggle autostart"),
        help_line("n  New VM (dialog)    Enter  Details    y  XML view"),
        help_line("l  View logs  v  Virt-viewer  V  noVNC  c  Console"),
        Line::from(""),
        help_section("Multi-select (VMs)"),
        help_line("Space  Toggle select    A  Select all    Esc  Clear"),
        help_line("Then s/x/H/b/p/u/d to batch operate"),
        Line::from(""),
        help_section("Network / Storage Actions"),
        help_line("a  Start (network or pool)    z  Stop (network or pool)"),
        help_line("Enter  Browse volumes (Storage)    Backspace  Go back"),
        Line::from(""),
        help_section("Snapshot Actions"),
        help_line("R  Revert    d  Delete    :snap <vm> <name>  Create"),
        Line::from(""),
        help_section("Sort (VMs)"),
        help_line("N  Name    S  State    C  CPU    M  Memory"),
        Line::from(""),
        help_section("General"),
        help_line("/  Search (fuzzy)  :  Command  r  Refresh  Ctrl+Space  Menu"),
        help_line("?/F1  Help    q/Esc  Quit"),
        Line::from(""),
        help_section("Commands"),
        help_line(":vms :net :storage :snap :events :node :quit"),
        help_line(":create  :create <n> [cpu mem]  :clone <s> <n>"),
        help_line(":snap <vm> <n>  :template <tmpl> <n>  :templates"),
        help_line(":rename <old> <new>  :netcreate <n>  :netdelete <n>"),
        help_line(":resize <n> vcpus|memory <v>"),
        Line::from(""),
        Line::from(Span::styled("Press any key to close", Style::default().fg(DARK_ORANGE))),
    ];

    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(ORANGE).add_modifier(Modifier::BOLD))
        .title(" Help ")
        .title_style(Style::default().fg(ORANGE).add_modifier(Modifier::BOLD))
        .style(Style::default().bg(Color::Black));

    frame.render_widget(
        Paragraph::new(lines).style(Style::default().fg(TEXT_COLOR)).block(block),
        help_area,
    );
}

fn help_section(title: &str) -> Line<'_> {
    Line::from(Span::styled(
        title,
        Style::default().fg(LIGHT_ORANGE).add_modifier(Modifier::BOLD | Modifier::UNDERLINED),
    ))
}

fn help_line(text: &str) -> Line<'_> {
    Line::from(Span::styled(format!("  {text}"), Style::default().fg(TEXT_COLOR)))
}

// ── Status bar ──────────────────────────────────────────────────────────

fn render_status_bar(frame: &mut Frame, area: Rect, state: &AppState) {
    let status = Paragraph::new(Line::from(Span::styled(
        &state.status_message,
        Style::default().fg(INFO_COLOR),
    )));
    frame.render_widget(status, area);
}

// ── Context-sensitive bottom bar (Phase 1, #2) ──────────────────────────

fn render_bottom_bar(frame: &mut Frame, area: Rect, state: &AppState) {
    let line = match state.input_mode {
        InputMode::Search => Line::from(vec![
            Span::styled("/", Style::default().fg(ORANGE).add_modifier(Modifier::BOLD)),
            Span::styled(&state.search_query, Style::default().fg(TEXT_COLOR).add_modifier(Modifier::UNDERLINED)),
            Span::styled("_", Style::default().fg(ORANGE)),
        ]),
        InputMode::Command => Line::from(vec![
            Span::styled(":", Style::default().fg(ORANGE).add_modifier(Modifier::BOLD)),
            Span::styled(&state.command_input, Style::default().fg(TEXT_COLOR).add_modifier(Modifier::UNDERLINED)),
            Span::styled("_", Style::default().fg(ORANGE)),
        ]),
        InputMode::Confirmation => Line::from(Span::styled(
            "",
            Style::default().fg(ERROR_COLOR),
        )),
        InputMode::CreateVmDialog => Line::from(Span::styled(
            "",
            Style::default().fg(TEXT_COLOR),
        )),
        InputMode::Normal => {
            build_context_help_line(state)
        }
    };
    frame.render_widget(Paragraph::new(line), area);
}

/// Build context-sensitive help hints based on current view and selected item state
fn build_context_help_line(state: &AppState) -> Line<'static> {
    let mut spans: Vec<Span> = Vec::new();

    let add_hint = |spans: &mut Vec<Span>, key: &str, desc: &str| {
        spans.push(Span::styled(key.to_string(), Style::default().fg(ORANGE).add_modifier(Modifier::BOLD)));
        spans.push(Span::styled(format!(":{desc} "), Style::default().fg(DARK_ORANGE)));
    };

    match state.resource_view {
        ResourceView::VirtualMachines => {
            add_hint(&mut spans, "?", "help");
            add_hint(&mut spans, "/", "search");
            add_hint(&mut spans, "n", "new");

            // Show context-sensitive VM actions based on selected VM state
            if let Some(name) = state.selected_vm_name() {
                let vm_state = state.vms.iter()
                    .find(|v| v.name == name)
                    .map(|v| v.state.as_str())
                    .unwrap_or("");

                match vm_state {
                    "shutoff" => {
                        add_hint(&mut spans, "s", "start");
                        add_hint(&mut spans, "d", "del");
                    }
                    "running" => {
                        add_hint(&mut spans, "x", "stop");
                        add_hint(&mut spans, "H", "shut");
                        add_hint(&mut spans, "p", "pause");
                        add_hint(&mut spans, "b", "reboot");
                    }
                    "paused" => {
                        add_hint(&mut spans, "u", "resume");
                        add_hint(&mut spans, "x", "stop");
                    }
                    _ => {
                        add_hint(&mut spans, "s", "start");
                        add_hint(&mut spans, "x", "stop");
                    }
                }
                add_hint(&mut spans, "Enter", "details");
                add_hint(&mut spans, "v", "vnc");
            } else {
                add_hint(&mut spans, "s", "start");
                add_hint(&mut spans, "x", "stop");
            }
        }
        ResourceView::Networks => {
            add_hint(&mut spans, "?", "help");
            add_hint(&mut spans, "/", "search");
            add_hint(&mut spans, "a", "start");
            add_hint(&mut spans, "z", "stop");
            add_hint(&mut spans, "r", "refresh");
        }
        ResourceView::StoragePools => {
            add_hint(&mut spans, "?", "help");
            add_hint(&mut spans, "/", "search");
            add_hint(&mut spans, "a", "start");
            add_hint(&mut spans, "z", "stop");
            if state.browsing_pool.is_some() {
                add_hint(&mut spans, "Bksp", "back");
            } else {
                add_hint(&mut spans, "Enter", "volumes");
            }
            add_hint(&mut spans, "r", "refresh");
        }
        ResourceView::Snapshots => {
            add_hint(&mut spans, "?", "help");
            add_hint(&mut spans, "/", "search");
            add_hint(&mut spans, "R", "revert");
            add_hint(&mut spans, "d", "delete");
        }
        ResourceView::Events => {
            add_hint(&mut spans, "?", "help");
            add_hint(&mut spans, "r", "refresh");
        }
        ResourceView::Node => {
            add_hint(&mut spans, "?", "help");
            add_hint(&mut spans, "r", "refresh");
        }
    }

    Line::from(spans)
}

// ── Format helpers ──────────────────────────────────────────────────────

fn format_bytes(bytes: u64) -> String {
    if bytes >= 1_073_741_824 {
        format!("{:.1} GB", bytes as f64 / 1_073_741_824.0)
    } else if bytes >= 1_048_576 {
        format!("{:.1} MB", bytes as f64 / 1_048_576.0)
    } else if bytes >= 1024 {
        format!("{:.1} KB", bytes as f64 / 1024.0)
    } else {
        format!("{bytes} B")
    }
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
