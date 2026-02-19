use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, Cell, Clear, Paragraph, Row, Table, Wrap};
use ratatui::Frame;

use virtspawn_core::{AppState, InputMode, ResourceView, ViewMode};

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
    let mut spans: Vec<Span> = vec![
        Span::styled(" virtspawn ", Style::default().fg(ORANGE).add_modifier(Modifier::BOLD)),
        Span::styled("\u{2502} ", Style::default().fg(DARK_ORANGE)),
    ];

    for (i, view) in ResourceView::all().iter().enumerate() {
        let num = format!("{}:", i + 1);
        let label = view.label();
        let is_active = *view == state.resource_view;

        if is_active {
            spans.push(Span::styled(
                format!("{num}{label}"),
                Style::default()
                    .fg(ORANGE)
                    .add_modifier(Modifier::BOLD | Modifier::UNDERLINED),
            ));
        } else {
            spans.push(Span::styled(num, Style::default().fg(DARK_ORANGE)));
            spans.push(Span::styled(label, Style::default().fg(TEXT_COLOR)));
        }
        spans.push(Span::raw("  "));
    }

    // Connection indicator
    let (conn_icon, conn_color) = if state.connected {
        ("\u{25cf}", SUCCESS_COLOR)
    } else {
        ("\u{25cf}", ERROR_COLOR)
    };
    spans.push(Span::styled(conn_icon, Style::default().fg(conn_color)));

    if state.multi_select_mode {
        spans.push(Span::styled(
            format!(" [{}sel]", state.selected_items.len()),
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
        ResourceView::StoragePools => render_storage_table(frame, area, state),
        ResourceView::Snapshots => render_snapshot_table(frame, area, state),
        ResourceView::Events => render_events_table(frame, area, state),
        ResourceView::Node => render_node_view(frame, area, state),
    }
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
                Cell::from(vm.vcpus.to_string()).style(Style::default().fg(TEXT_COLOR)),
                Cell::from(vm.memory_mb.to_string()).style(Style::default().fg(TEXT_COLOR)),
            ];

            if has_metrics {
                let pct = state
                    .get_metrics_for_vm(&vm.name)
                    .map(|m| format!("{:.0}%", m.memory_pct))
                    .unwrap_or_else(|| "-".to_string());
                let pct_color = state
                    .get_metrics_for_vm(&vm.name)
                    .map(|m| {
                        if m.memory_pct > 90.0 { ERROR_COLOR }
                        else if m.memory_pct > 70.0 { WARNING_COLOR }
                        else { SUCCESS_COLOR }
                    })
                    .unwrap_or(Color::DarkGray);
                cells.push(Cell::from(pct).style(Style::default().fg(pct_color)));
            }

            let row = Row::new(cells);
            if display_idx == state.selected_index {
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
        .column_spacing(2)
        .block(themed_block(format!(" VMs ({count}) ")));

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
    .style(header_style())
    .bottom_margin(1);

    let rows: Vec<Row> = state
        .networks
        .iter()
        .enumerate()
        .map(|(i, net)| {
            let active_color = if net.active { SUCCESS_COLOR } else { ERROR_COLOR };
            let row = Row::new(vec![
                Cell::from(net.name.clone()).style(Style::default().fg(LIGHT_ORANGE)),
                Cell::from(if net.active { "yes" } else { "no" })
                    .style(Style::default().fg(active_color)),
                Cell::from(if net.autostart { "yes" } else { "no" }).style(Style::default().fg(TEXT_COLOR)),
                Cell::from(net.bridge.clone()).style(Style::default().fg(TEXT_COLOR)),
                Cell::from(if net.persistent { "yes" } else { "no" }).style(Style::default().fg(TEXT_COLOR)),
            ]);
            if i == state.selected_index { row.style(selected_style()) } else { row }
        })
        .collect();

    let table = Table::new(
        rows,
        [
            Constraint::Percentage(25), Constraint::Percentage(15),
            Constraint::Percentage(15), Constraint::Percentage(25),
            Constraint::Percentage(20),
        ],
    )
    .header(header)
    .column_spacing(2)
    .block(themed_block(format!(" Networks ({}) ", state.networks.len())));
    frame.render_widget(table, area);
}

// ── Storage table ───────────────────────────────────────────────────────

fn render_storage_table(frame: &mut Frame, area: Rect, state: &AppState) {
    let header = Row::new(vec![
        Cell::from("Name"), Cell::from("State"), Cell::from("Capacity (GB)"),
        Cell::from("Used (GB)"), Cell::from("Available (GB)"), Cell::from("Autostart"),
    ])
    .style(header_style())
    .bottom_margin(1);

    let rows: Vec<Row> = state
        .storage_pools
        .iter()
        .enumerate()
        .map(|(i, pool)| {
            let sc = state_color(&pool.state);
            let row = Row::new(vec![
                Cell::from(pool.name.clone()).style(Style::default().fg(LIGHT_ORANGE)),
                Cell::from(pool.state.clone()).style(Style::default().fg(sc)),
                Cell::from(format!("{:.1}", pool.capacity_gb)).style(Style::default().fg(TEXT_COLOR)),
                Cell::from(format!("{:.1}", pool.allocation_gb)).style(Style::default().fg(TEXT_COLOR)),
                Cell::from(format!("{:.1}", pool.available_gb)).style(Style::default().fg(SUCCESS_COLOR)),
                Cell::from(if pool.autostart { "yes" } else { "no" }).style(Style::default().fg(TEXT_COLOR)),
            ]);
            if i == state.selected_index { row.style(selected_style()) } else { row }
        })
        .collect();

    let table = Table::new(
        rows,
        [
            Constraint::Percentage(20), Constraint::Percentage(15),
            Constraint::Percentage(18), Constraint::Percentage(15),
            Constraint::Percentage(18), Constraint::Percentage(14),
        ],
    )
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
    let text = if let Some(ref node) = state.node_info {
        vec![
            kv_line("Hostname:       ", &node.hostname),
            kv_line("Hypervisor:     ", &format!("{} {}", node.hypervisor, node.hypervisor_version)),
            kv_line("Libvirt:        ", &node.lib_version),
            Line::from(""),
            kv_line("CPU Model:      ", &node.cpu_model),
            kv_line("CPU Sockets:    ", &node.cpu_sockets.to_string()),
            kv_line("CPU Cores:      ", &node.cpu_cores.to_string()),
            kv_line("CPU Threads:    ", &node.cpu_threads.to_string()),
            kv_line("NUMA Nodes:     ", &node.numa_nodes.to_string()),
            Line::from(""),
            kv_line("Memory:         ", &format!("{} MB", node.memory_mb)),
            Line::from(""),
            Line::from(vec![
                Span::styled("Active VMs:     ", Style::default().fg(ORANGE)),
                Span::styled(node.active_vms.to_string(), Style::default().fg(SUCCESS_COLOR).add_modifier(Modifier::BOLD)),
            ]),
            kv_line("Defined VMs:    ", &node.defined_vms.to_string()),
        ]
    } else {
        vec![Line::from(Span::styled("Loading node info...", Style::default().fg(TEXT_COLOR)))]
    };

    let paragraph = Paragraph::new(text)
        .style(Style::default().fg(TEXT_COLOR))
        .block(themed_block(" Node Info ".to_string()));
    frame.render_widget(paragraph, area);
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
            ("c", "Console"), ("i", "Details"),
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
        help_line("Enter  Details    y  XML view   v  Virt-viewer"),
        Line::from(""),
        help_section("Multi-select (VMs)"),
        help_line("Space  Toggle select    A  Select all    Esc  Clear"),
        help_line("Then s/x/H/b/p/u/d to batch operate"),
        Line::from(""),
        help_section("Network / Storage Actions"),
        help_line("a  Start (network or pool)    z  Stop (network or pool)"),
        Line::from(""),
        help_section("Snapshot Actions"),
        help_line("R  Revert    d  Delete    :snap <vm> <name>  Create"),
        Line::from(""),
        help_section("Sort (VMs)"),
        help_line("N  Name    S  State    C  CPU    M  Memory"),
        Line::from(""),
        help_section("General"),
        help_line("/  Search    :  Command    r  Refresh    Ctrl+Space  Menu"),
        help_line("?/F1  Help    q/Esc  Quit"),
        Line::from(""),
        help_section("Commands"),
        help_line(":vms :net :storage :snap :events :node :quit"),
        help_line(":clone <s> <n>  :snap <vm> <n>  :create <n> [cpu mem]"),
        help_line(":template <tmpl> <n>  :rename <old> <new>  :templates"),
        help_line(":netcreate <n>  :netdelete <n>  :resize <n> vcpus|memory <v>"),
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

// ── Bottom bar ──────────────────────────────────────────────────────────

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
            "Press 'y' to confirm, any other key to cancel",
            Style::default().fg(ERROR_COLOR).add_modifier(Modifier::BOLD),
        )),
        InputMode::Normal => {
            let help_text = match state.resource_view {
                ResourceView::VirtualMachines => {
                    "?:help /:search s:start x:stop H:shut b:boot p:pause u:resume d:del o:clone y:xml t:autostart"
                }
                ResourceView::Networks => "?:help /:search a:start z:stop r:refresh",
                ResourceView::StoragePools => "?:help /:search a:start z:stop r:refresh",
                ResourceView::Snapshots => "?:help /:search R:revert d:delete :snap <vm> <name>",
                ResourceView::Events => "?:help r:refresh",
                ResourceView::Node => "?:help r:refresh",
            };
            Line::from(Span::styled(help_text, Style::default().fg(DARK_ORANGE)))
        }
    };
    frame.render_widget(Paragraph::new(line), area);
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
