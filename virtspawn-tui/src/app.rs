use crossterm::event::{self, Event, KeyCode, KeyEvent, KeyModifiers};
use ratatui::DefaultTerminal;
use std::time::{Duration, Instant};

use virtspawn_core::{
    AppState, InputMode, ResourceView, SortColumn, SortDirection, ViewMode,
};

use crate::api::DaemonClient;
use crate::ui;

pub struct App {
    pub state: AppState,
    pub should_quit: bool,
    client: DaemonClient,
    refresh_interval: Duration,
}

impl App {
    pub fn new(client: DaemonClient, refresh_interval_secs: u64) -> Self {
        Self {
            state: AppState::new(),
            should_quit: false,
            client,
            refresh_interval: Duration::from_secs(refresh_interval_secs),
        }
    }

    pub async fn run(&mut self, mut terminal: DefaultTerminal) -> anyhow::Result<()> {
        self.refresh_current_view().await;

        let mut last_refresh = Instant::now();

        while !self.should_quit {
            terminal.draw(|frame| ui::render(frame, &self.state))?;

            if event::poll(Duration::from_millis(250))? {
                if let Event::Key(key) = event::read()? {
                    self.handle_key(key).await;
                }
            }

            if last_refresh.elapsed() >= self.refresh_interval {
                self.refresh_current_view().await;
                last_refresh = Instant::now();
            }
        }

        Ok(())
    }

    async fn handle_key(&mut self, key: KeyEvent) {
        match self.state.input_mode {
            InputMode::Search => self.handle_search_key(key),
            InputMode::Confirmation => self.handle_confirmation_key(key).await,
            InputMode::Command => self.handle_command_key(key).await,
            InputMode::Normal => self.handle_normal_key(key).await,
        }
    }

    // ── Normal mode ─────────────────────────────────────────────────────

    async fn handle_normal_key(&mut self, key: KeyEvent) {
        match self.state.view_mode {
            ViewMode::Help => {
                // Any key exits help
                self.state.view_mode = ViewMode::Table;
                return;
            }
            ViewMode::Details => {
                match key.code {
                    KeyCode::Esc | KeyCode::Char('q') => {
                        self.state.view_mode = ViewMode::Table;
                        self.state.vm_details = None;
                    }
                    _ => {}
                }
                return;
            }
            ViewMode::Table => {}
        }

        match key.code {
            // Quit
            KeyCode::Char('q') | KeyCode::Esc => self.should_quit = true,

            // Navigation
            KeyCode::Char('j') | KeyCode::Down => self.move_down(),
            KeyCode::Char('k') | KeyCode::Up => self.move_up(),
            KeyCode::Char('g') => self.state.selected_index = 0,
            KeyCode::Char('G') => {
                let len = self.state.current_list_len();
                if len > 0 {
                    self.state.selected_index = len - 1;
                }
            }

            // View switching
            KeyCode::Tab => {
                self.state.resource_view = self.state.resource_view.next();
                self.state.selected_index = 0;
                self.state.search_query.clear();
                self.state.filtered_indices.clear();
                self.refresh_current_view().await;
            }
            KeyCode::BackTab => {
                self.state.resource_view = self.state.resource_view.prev();
                self.state.selected_index = 0;
                self.state.search_query.clear();
                self.state.filtered_indices.clear();
                self.refresh_current_view().await;
            }
            KeyCode::Char('1') => self.switch_view(ResourceView::VirtualMachines).await,
            KeyCode::Char('2') => self.switch_view(ResourceView::Networks).await,
            KeyCode::Char('3') => self.switch_view(ResourceView::StoragePools).await,
            KeyCode::Char('4') => self.switch_view(ResourceView::Snapshots).await,
            KeyCode::Char('5') => self.switch_view(ResourceView::Node).await,

            // Search
            KeyCode::Char('/') => {
                self.state.input_mode = InputMode::Search;
                self.state.search_query.clear();
                self.state.filtered_indices.clear();
            }

            // Command mode
            KeyCode::Char(':') => {
                self.state.input_mode = InputMode::Command;
                self.state.command_input.clear();
            }

            // Help
            KeyCode::Char('?') | KeyCode::F(1) => {
                self.state.view_mode = ViewMode::Help;
            }

            // Details (Enter on VMs view)
            KeyCode::Enter => {
                if self.state.resource_view == ResourceView::VirtualMachines {
                    self.show_vm_details().await;
                }
            }

            // Sort
            KeyCode::Char('N') if key.modifiers.contains(KeyModifiers::SHIFT) => {
                self.toggle_sort(SortColumn::Name);
            }
            KeyCode::Char('S') if key.modifiers.contains(KeyModifiers::SHIFT) => {
                if self.state.resource_view == ResourceView::VirtualMachines {
                    self.toggle_sort(SortColumn::State);
                }
            }
            KeyCode::Char('C') if key.modifiers.contains(KeyModifiers::SHIFT) => {
                self.toggle_sort(SortColumn::Cpu);
            }
            KeyCode::Char('M') if key.modifiers.contains(KeyModifiers::SHIFT) => {
                self.toggle_sort(SortColumn::Memory);
            }

            // Refresh
            KeyCode::Char('r') => self.refresh_current_view().await,

            // VM actions
            KeyCode::Char('s') => self.vm_action("start").await,
            KeyCode::Char('x') => self.vm_action("stop").await,
            KeyCode::Char('h') if key.modifiers.contains(KeyModifiers::SHIFT) => {
                self.vm_action("shutdown").await;
            }
            KeyCode::Char('b') => self.vm_action("reboot").await,
            KeyCode::Char('p') => self.vm_action("pause").await,
            KeyCode::Char('u') => self.vm_action("resume").await,
            KeyCode::Char('d') => {
                self.request_confirmation().await;
            }

            // Snapshot actions (on Snapshots view)
            KeyCode::Char('c') => {
                if self.state.resource_view == ResourceView::Snapshots {
                    // Create snapshot for selected VM — use command mode
                    self.state.status_message =
                        "Use ':snap <vm> <name>' to create a snapshot".to_string();
                }
            }
            KeyCode::Char('R') => {
                if self.state.resource_view == ResourceView::Snapshots {
                    self.revert_snapshot().await;
                }
            }

            // Network actions
            KeyCode::Char('a') => {
                if self.state.resource_view == ResourceView::Networks {
                    self.network_action("start").await;
                }
            }
            KeyCode::Char('z') => {
                if self.state.resource_view == ResourceView::Networks {
                    self.network_action("stop").await;
                }
            }

            _ => {}
        }
    }

    // ── Search mode ─────────────────────────────────────────────────────

    fn handle_search_key(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Esc => {
                self.state.input_mode = InputMode::Normal;
                self.state.search_query.clear();
                self.state.filtered_indices.clear();
                self.state.clamp_selection();
            }
            KeyCode::Enter => {
                self.state.input_mode = InputMode::Normal;
            }
            KeyCode::Backspace => {
                self.state.search_query.pop();
                self.state.apply_search_filter();
            }
            KeyCode::Char(c) => {
                self.state.search_query.push(c);
                self.state.apply_search_filter();
            }
            _ => {}
        }
    }

    // ── Confirmation mode ───────────────────────────────────────────────

    async fn handle_confirmation_key(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Char('y') => {
                self.state.input_mode = InputMode::Normal;
                if let Some(action) = self.state.confirm_action.take() {
                    self.execute_confirmed_action(&action).await;
                }
            }
            _ => {
                self.state.input_mode = InputMode::Normal;
                self.state.confirm_action = None;
                self.state.status_message = "Cancelled".to_string();
            }
        }
    }

    // ── Command mode ────────────────────────────────────────────────────

    async fn handle_command_key(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Esc => {
                self.state.input_mode = InputMode::Normal;
                self.state.command_input.clear();
            }
            KeyCode::Enter => {
                self.state.input_mode = InputMode::Normal;
                let cmd = self.state.command_input.clone();
                self.state.command_input.clear();
                self.execute_command(&cmd).await;
            }
            KeyCode::Backspace => {
                self.state.command_input.pop();
            }
            KeyCode::Char(c) => {
                self.state.command_input.push(c);
            }
            _ => {}
        }
    }

    // ── Navigation helpers ──────────────────────────────────────────────

    fn move_down(&mut self) {
        let len = self.state.current_list_len();
        if len > 0 {
            self.state.selected_index = (self.state.selected_index + 1) % len;
        }
    }

    fn move_up(&mut self) {
        let len = self.state.current_list_len();
        if len > 0 {
            self.state.selected_index = if self.state.selected_index == 0 {
                len - 1
            } else {
                self.state.selected_index - 1
            };
        }
    }

    async fn switch_view(&mut self, view: ResourceView) {
        self.state.resource_view = view;
        self.state.selected_index = 0;
        self.state.search_query.clear();
        self.state.filtered_indices.clear();
        self.refresh_current_view().await;
    }

    fn toggle_sort(&mut self, col: SortColumn) {
        if self.state.sort_column == col {
            self.state.sort_direction = self.state.sort_direction.toggle();
        } else {
            self.state.sort_column = col;
            self.state.sort_direction = SortDirection::Ascending;
        }
        self.state.sort_vms();
    }

    // ── VM actions ──────────────────────────────────────────────────────

    async fn vm_action(&mut self, action: &str) {
        if self.state.resource_view != ResourceView::VirtualMachines {
            return;
        }
        let name = match self.state.selected_vm_name() {
            Some(n) => n.to_string(),
            None => return,
        };

        let result = match action {
            "start" => self.client.start_vm(&name).await,
            "stop" => self.client.stop_vm(&name).await,
            "shutdown" => self.client.shutdown_vm(&name).await,
            "reboot" => self.client.reboot_vm(&name).await,
            "pause" => self.client.pause_vm(&name).await,
            "resume" => self.client.resume_vm(&name).await,
            _ => return,
        };

        match result {
            Ok(()) => {
                self.state.status_message = format!("{action}: '{name}' OK");
                self.refresh_current_view().await;
            }
            Err(e) => self.state.status_message = format!("Error {action} '{name}': {e}"),
        }
    }

    async fn request_confirmation(&mut self) {
        let desc = match self.state.resource_view {
            ResourceView::VirtualMachines => {
                self.state.selected_vm_name().map(|n| format!("delete-vm:{n}"))
            }
            ResourceView::Snapshots => self.state.selected_snapshot().map(|s| {
                format!("delete-snap:{}:{}", s.vm_name, s.name)
            }),
            _ => None,
        };

        if let Some(action) = desc {
            self.state.status_message =
                format!("Confirm? Press 'y' to proceed, any other key to cancel");
            self.state.confirm_action = Some(action);
            self.state.input_mode = InputMode::Confirmation;
        }
    }

    async fn execute_confirmed_action(&mut self, action: &str) {
        let parts: Vec<&str> = action.splitn(3, ':').collect();
        match parts.as_slice() {
            ["delete-vm", name] => {
                match self.client.delete_vm(name).await {
                    Ok(()) => {
                        self.state.status_message = format!("Deleted VM '{name}'");
                        self.refresh_current_view().await;
                        self.state.clamp_selection();
                    }
                    Err(e) => self.state.status_message = format!("Error deleting '{name}': {e}"),
                }
            }
            ["delete-snap", vm_name, snap_name] => {
                match self.client.delete_snapshot(vm_name, snap_name).await {
                    Ok(()) => {
                        self.state.status_message =
                            format!("Deleted snapshot '{snap_name}' from '{vm_name}'");
                        self.refresh_current_view().await;
                        self.state.clamp_selection();
                    }
                    Err(e) => self.state.status_message = format!("Error: {e}"),
                }
            }
            _ => {}
        }
    }

    async fn show_vm_details(&mut self) {
        if let Some(name) = self.state.selected_vm_name().map(|s| s.to_string()) {
            match self.client.get_vm_details(&name).await {
                Ok(details) => {
                    self.state.vm_details = Some(details);
                    self.state.view_mode = ViewMode::Details;
                }
                Err(e) => {
                    self.state.status_message = format!("Error fetching details: {e}");
                }
            }
        }
    }

    // ── Snapshot actions ────────────────────────────────────────────────

    async fn revert_snapshot(&mut self) {
        if let Some(snap) = self.state.selected_snapshot().cloned() {
            match self.client.revert_snapshot(&snap.vm_name, &snap.name).await {
                Ok(()) => {
                    self.state.status_message =
                        format!("Reverted '{}' to snapshot '{}'", snap.vm_name, snap.name);
                    self.refresh_current_view().await;
                }
                Err(e) => self.state.status_message = format!("Error reverting: {e}"),
            }
        }
    }

    // ── Network actions ─────────────────────────────────────────────────

    async fn network_action(&mut self, action: &str) {
        let name = match self.state.selected_network_name() {
            Some(n) => n.to_string(),
            None => return,
        };

        let result = match action {
            "start" => self.client.start_network(&name).await,
            "stop" => self.client.stop_network(&name).await,
            _ => return,
        };

        match result {
            Ok(()) => {
                self.state.status_message = format!("Network '{name}': {action} OK");
                self.refresh_current_view().await;
            }
            Err(e) => self.state.status_message = format!("Error: {e}"),
        }
    }

    // ── Command execution ───────────────────────────────────────────────

    async fn execute_command(&mut self, cmd: &str) {
        let parts: Vec<&str> = cmd.split_whitespace().collect();
        match parts.as_slice() {
            ["vms"] => self.switch_view(ResourceView::VirtualMachines).await,
            ["net"] | ["networks"] => self.switch_view(ResourceView::Networks).await,
            ["pool"] | ["storage"] => self.switch_view(ResourceView::StoragePools).await,
            ["snap"] | ["snapshots"] => self.switch_view(ResourceView::Snapshots).await,
            ["node"] => self.switch_view(ResourceView::Node).await,
            ["snap", vm, name] => {
                match self.client.create_snapshot(vm, name, "").await {
                    Ok(()) => {
                        self.state.status_message = format!("Created snapshot '{name}' for '{vm}'");
                        if self.state.resource_view == ResourceView::Snapshots {
                            self.refresh_current_view().await;
                        }
                    }
                    Err(e) => self.state.status_message = format!("Error: {e}"),
                }
            }
            ["q"] | ["quit"] => self.should_quit = true,
            _ => {
                self.state.status_message = format!("Unknown command: {cmd}");
            }
        }
    }

    // ── Refresh ─────────────────────────────────────────────────────────

    async fn refresh_current_view(&mut self) {
        match self.state.resource_view {
            ResourceView::VirtualMachines => {
                match self.client.fetch_vms().await {
                    Ok(vms) => {
                        self.state.vms = vms;
                        self.state.sort_vms();
                        self.state.clamp_selection();
                    }
                    Err(e) => self.state.status_message = format!("Error: {e}"),
                }
            }
            ResourceView::Networks => {
                match self.client.fetch_networks().await {
                    Ok(nets) => {
                        self.state.networks = nets;
                        self.state.clamp_selection();
                    }
                    Err(e) => self.state.status_message = format!("Error: {e}"),
                }
            }
            ResourceView::StoragePools => {
                match self.client.fetch_storage_pools().await {
                    Ok(pools) => {
                        self.state.storage_pools = pools;
                        self.state.clamp_selection();
                    }
                    Err(e) => self.state.status_message = format!("Error: {e}"),
                }
            }
            ResourceView::Snapshots => {
                match self.client.fetch_all_snapshots().await {
                    Ok(snaps) => {
                        self.state.snapshots = snaps;
                        self.state.clamp_selection();
                    }
                    Err(e) => self.state.status_message = format!("Error: {e}"),
                }
            }
            ResourceView::Node => {
                match self.client.fetch_node_info().await {
                    Ok(info) => self.state.node_info = Some(info),
                    Err(e) => self.state.status_message = format!("Error: {e}"),
                }
            }
        }
    }
}
