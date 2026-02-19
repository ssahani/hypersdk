use ratatui::layout::{Constraint, Layout};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, Cell, Paragraph, Row, Table};
use ratatui::Frame;

use virtspawn_core::AppState;

pub fn render(frame: &mut Frame, state: &AppState, _confirm_delete: bool) {
    let chunks = Layout::vertical([
        Constraint::Min(0),
        Constraint::Length(1),
        Constraint::Length(1),
    ])
    .split(frame.area());

    // VM table
    let header = Row::new(vec![
        Cell::from("Name"),
        Cell::from("State"),
        Cell::from("vCPUs"),
        Cell::from("Memory (MB)"),
    ])
    .style(Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD));

    let rows: Vec<Row> = state
        .vms
        .iter()
        .enumerate()
        .map(|(i, vm)| {
            let state_color = match vm.state.as_str() {
                "running" => Color::Green,
                "shutoff" => Color::Red,
                "paused" => Color::Yellow,
                _ => Color::Gray,
            };

            let row = Row::new(vec![
                Cell::from(vm.name.clone()),
                Cell::from(vm.state.clone()).style(Style::default().fg(state_color)),
                Cell::from(vm.vcpus.to_string()),
                Cell::from(vm.memory_mb.to_string()),
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
    .block(Block::default().borders(Borders::ALL).title(" virtspawn - VM Manager "));

    frame.render_widget(table, chunks[0]);

    // Status bar
    let status = Paragraph::new(Line::from(Span::styled(
        &state.status_message,
        Style::default().fg(Color::Cyan),
    )));
    frame.render_widget(status, chunks[1]);

    // Help line
    let help = Paragraph::new(Line::from(Span::styled(
        "q:quit  \u{2191}\u{2193}/jk:navigate  s:start  S:stop  d:delete  r:refresh",
        Style::default().fg(Color::DarkGray),
    )));
    frame.render_widget(help, chunks[2]);
}
