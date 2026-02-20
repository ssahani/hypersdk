use crossterm::event::{self, Event, KeyCode, KeyEvent, KeyModifiers, MouseEvent, MouseEventKind};
use ratatui::DefaultTerminal;
use std::time::{Duration, Instant};

use virtspawn_core::{
    AppState, ConfirmationDialog, CreateNetworkRequest, CreateVmForm, CreateVmRequest, InputMode,
    NotifyLevel, ResourceView, SortColumn, SortDirection, ViewMode, VmTemplate,
};

use crate::api::DaemonClient;
use crate::ui;

pub struct App {
    pub state: AppState,
    pub should_quit: bool,
    pub connected: bool,
    client: DaemonClient,
    refresh_interval: Duration,
}

impl App {
    pub fn new(client: DaemonClient, refresh_interval_secs: u64) -> Self {
        Self {
            state: AppState::new(),
            should_quit: false,
            connected: false,
            client,
            refresh_interval: Duration::from_secs(refresh_interval_secs),
        }
    }

    pub async fn run(&mut self, mut terminal: DefaultTerminal) -> anyhow::Result<()> {
        self.state.load_audit_history();
        self.refresh_current_view().await;

        let mut last_refresh = Instant::now();

        while !self.should_quit {
            terminal.draw(|frame| ui::render(frame, &self.state))?;

            if event::poll(Duration::from_millis(250))? {
                match event::read()? {
                    Event::Key(key) => self.handle_key(key).await,
                    Event::Mouse(mouse) => self.handle_mouse(mouse),
                    _ => {}
                }
            }

            if last_refresh.elapsed() >= self.refresh_interval {
                self.refresh_current_view().await;
                // Also refresh metrics if on VM view
                if self.state.resource_view == ResourceView::VirtualMachines {
                    self.refresh_metrics().await;
                }
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
            InputMode::CreateVmDialog => self.handle_create_dialog_key(key).await,
            InputMode::Normal => self.handle_normal_key(key).await,
        }
    }

    // ── Normal mode ─────────────────────────────────────────────────────

    async fn handle_normal_key(&mut self, key: KeyEvent) {
        // Context menu handling
        if self.state.show_context_menu {
            self.handle_context_menu_key(key).await;
            return;
        }

        match self.state.view_mode {
            ViewMode::Help => {
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
            ViewMode::Logs => {
                match key.code {
                    KeyCode::Esc | KeyCode::Char('q') => {
                        self.state.view_mode = ViewMode::Table;
                        self.state.log_content.clear();
                        self.state.scroll_offset = 0;
                    }
                    KeyCode::Char('j') | KeyCode::Down => {
                        self.state.scroll_offset = self.state.scroll_offset.saturating_add(1);
                    }
                    KeyCode::Char('k') | KeyCode::Up => {
                        self.state.scroll_offset = self.state.scroll_offset.saturating_sub(1);
                    }
                    KeyCode::PageDown => {
                        self.state.scroll_offset = self.state.scroll_offset.saturating_add(20);
                    }
                    KeyCode::PageUp => {
                        self.state.scroll_offset = self.state.scroll_offset.saturating_sub(20);
                    }
                    _ => {}
                }
                return;
            }
            ViewMode::Xml => {
                match key.code {
                    KeyCode::Esc | KeyCode::Char('q') => {
                        self.state.view_mode = ViewMode::Table;
                        self.state.xml_content.clear();
                        self.state.scroll_offset = 0;
                    }
                    KeyCode::Char('j') | KeyCode::Down => {
                        self.state.scroll_offset = self.state.scroll_offset.saturating_add(1);
                    }
                    KeyCode::Char('k') | KeyCode::Up => {
                        self.state.scroll_offset = self.state.scroll_offset.saturating_sub(1);
                    }
                    KeyCode::PageDown => {
                        self.state.scroll_offset = self.state.scroll_offset.saturating_add(20);
                    }
                    KeyCode::PageUp => {
                        self.state.scroll_offset = self.state.scroll_offset.saturating_sub(20);
                    }
                    KeyCode::Char('g') => self.state.scroll_offset = 0,
                    _ => {}
                }
                return;
            }
            ViewMode::Table => {}
        }

        // Ctrl+Space: context menu
        if key.code == KeyCode::Char(' ') && key.modifiers.contains(KeyModifiers::CONTROL) {
            self.state.show_context_menu = true;
            return;
        }

        match key.code {
            // Quit
            KeyCode::Char('q') | KeyCode::Esc => {
                if self.state.multi_select_mode {
                    self.state.clear_selection();
                } else {
                    self.should_quit = true;
                }
            }

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
            KeyCode::PageDown => {
                let len = self.state.current_list_len();
                if len > 0 {
                    self.state.selected_index = (self.state.selected_index + 10).min(len - 1);
                }
            }
            KeyCode::PageUp => {
                self.state.selected_index = self.state.selected_index.saturating_sub(10);
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
            KeyCode::Char('5') => self.switch_view(ResourceView::Events).await,
            KeyCode::Char('6') => self.switch_view(ResourceView::Node).await,

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

            // Details / Enter pool to browse volumes
            KeyCode::Enter => {
                if self.state.resource_view == ResourceView::VirtualMachines {
                    if self.state.multi_select_mode {
                        if let Some(name) = self.state.selected_vm_name().map(|s| s.to_string()) {
                            self.state.toggle_selection(&name);
                        }
                    } else {
                        self.show_vm_details().await;
                    }
                } else if self.state.resource_view == ResourceView::StoragePools {
                    self.browse_pool_volumes().await;
                }
            }
            // Back from volume browser
            KeyCode::Backspace => {
                if self.state.browsing_pool.is_some() {
                    self.state.browsing_pool = None;
                    self.state.volumes.clear();
                    self.state.selected_index = 0;
                }
            }

            // Log viewer
            KeyCode::Char('l') => {
                if self.state.resource_view == ResourceView::VirtualMachines {
                    self.show_vm_logs().await;
                }
            }

            // XML view
            KeyCode::Char('y') => {
                if self.state.resource_view == ResourceView::VirtualMachines {
                    self.show_vm_xml().await;
                }
            }

            // Autostart toggle
            KeyCode::Char('t') => {
                if self.state.resource_view == ResourceView::VirtualMachines {
                    self.toggle_autostart().await;
                }
            }

            // Multi-select
            KeyCode::Char(' ') => {
                if self.state.resource_view == ResourceView::VirtualMachines {
                    if !self.state.multi_select_mode {
                        self.state.multi_select_mode = true;
                    }
                    if let Some(name) = self.state.selected_vm_name().map(|s| s.to_string()) {
                        self.state.toggle_selection(&name);
                    }
                    self.move_down();
                }
            }
            KeyCode::Char('A') if key.modifiers.contains(KeyModifiers::SHIFT) => {
                if self.state.resource_view == ResourceView::VirtualMachines {
                    self.state.multi_select_mode = true;
                    self.state.select_all_vms();
                    self.state.status_message =
                        format!("Selected all {} VMs", self.state.selected_items.len());
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
            KeyCode::Char('r') => {
                self.refresh_current_view().await;
                if self.state.resource_view == ResourceView::VirtualMachines {
                    self.refresh_metrics().await;
                }
            }

            // VM actions
            KeyCode::Char('s') => self.vm_action_or_batch("start").await,
            KeyCode::Char('x') => self.vm_action_or_batch("stop").await,
            KeyCode::Char('h') if key.modifiers.contains(KeyModifiers::SHIFT) => {
                self.vm_action_or_batch("shutdown").await;
            }
            KeyCode::Char('b') => self.vm_action_or_batch("reboot").await,
            KeyCode::Char('p') => self.vm_action_or_batch("pause").await,
            KeyCode::Char('u') => self.vm_action_or_batch("resume").await,
            KeyCode::Char('d') => self.request_confirmation().await,

            // Create VM dialog
            KeyCode::Char('n') => {
                if self.state.resource_view == ResourceView::VirtualMachines {
                    self.state.create_vm_form = Some(CreateVmForm::new());
                    self.state.input_mode = InputMode::CreateVmDialog;
                }
            }

            // Clone
            KeyCode::Char('o') => {
                if self.state.resource_view == ResourceView::VirtualMachines {
                    if let Some(name) = self.state.selected_vm_name().map(|s| s.to_string()) {
                        self.state.status_message =
                            format!("Use ':clone {} <new-name>' to clone", name);
                    }
                }
            }

            // Console / viewer
            KeyCode::Char('v') => self.launch_viewer().await,
            KeyCode::Char('V') => self.launch_novnc().await,
            KeyCode::Char('e') => self.launch_ssh().await,
            KeyCode::Char('c') => {
                if self.state.resource_view == ResourceView::Snapshots {
                    self.state.status_message =
                        "Use ':snap <vm> <name>' to create a snapshot".to_string();
                } else if self.state.resource_view == ResourceView::VirtualMachines {
                    self.launch_console().await;
                }
            }

            // Snapshot actions
            KeyCode::Char('R') => {
                if self.state.resource_view == ResourceView::Snapshots {
                    self.revert_snapshot().await;
                }
            }

            // Network actions
            KeyCode::Char('a') => {
                if self.state.resource_view == ResourceView::Networks {
                    self.network_action("start").await;
                } else if self.state.resource_view == ResourceView::StoragePools {
                    self.pool_action("start").await;
                }
            }
            KeyCode::Char('z') => {
                if self.state.resource_view == ResourceView::Networks {
                    self.network_action("stop").await;
                } else if self.state.resource_view == ResourceView::StoragePools {
                    self.pool_action("stop").await;
                }
            }

            _ => {}
        }
    }

    // ── Context menu ────────────────────────────────────────────────────

    async fn handle_context_menu_key(&mut self, key: KeyEvent) {
        self.state.show_context_menu = false;
        match key.code {
            KeyCode::Char('s') => self.vm_action_or_batch("start").await,
            KeyCode::Char('x') => self.vm_action_or_batch("stop").await,
            KeyCode::Char('h') => self.vm_action_or_batch("shutdown").await,
            KeyCode::Char('b') => self.vm_action_or_batch("reboot").await,
            KeyCode::Char('p') => self.vm_action_or_batch("pause").await,
            KeyCode::Char('u') => self.vm_action_or_batch("resume").await,
            KeyCode::Char('d') => self.request_confirmation().await,
            KeyCode::Char('o') => {
                if let Some(name) = self.state.selected_vm_name().map(|s| s.to_string()) {
                    self.state.status_message =
                        format!("Use ':clone {} <new-name>' to clone", name);
                }
            }
            KeyCode::Char('v') => self.launch_viewer().await,
            KeyCode::Char('c') => self.launch_console().await,
            KeyCode::Char('i') => self.show_vm_details().await,
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
                if let Some(dialog) = self.state.confirm_dialog.take() {
                    self.execute_confirmed_action(&dialog.action).await;
                }
            }
            _ => {
                self.state.input_mode = InputMode::Normal;
                self.state.confirm_dialog = None;
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

    // ── Create VM dialog ──────────────────────────────────────────────────

    async fn handle_create_dialog_key(&mut self, key: KeyEvent) {
        let form = match self.state.create_vm_form.as_mut() {
            Some(f) => f,
            None => {
                self.state.input_mode = InputMode::Normal;
                return;
            }
        };

        match key.code {
            KeyCode::Esc => {
                self.state.create_vm_form = None;
                self.state.input_mode = InputMode::Normal;
            }
            KeyCode::Tab | KeyCode::Down => {
                form.focused_field = (form.focused_field + 1) % form.fields.len();
            }
            KeyCode::BackTab | KeyCode::Up => {
                if form.focused_field == 0 {
                    form.focused_field = form.fields.len() - 1;
                } else {
                    form.focused_field -= 1;
                }
            }
            KeyCode::Left => {
                if form.fields[form.focused_field].field_type
                    == virtspawn_core::FormFieldType::TemplateSelect
                {
                    let templates = VmTemplate::all();
                    let count = templates.len() + 1; // +1 for "(none)"
                    if form.template_index == 0 {
                        form.template_index = count - 1;
                    } else {
                        form.template_index -= 1;
                    }
                    if form.template_index == 0 {
                        form.fields[1].value = "(none)".to_string();
                    } else {
                        let tmpl = &templates[form.template_index - 1];
                        form.fields[1].value = tmpl.name.clone();
                        form.apply_template(tmpl);
                    }
                }
            }
            KeyCode::Right => {
                if form.fields[form.focused_field].field_type
                    == virtspawn_core::FormFieldType::TemplateSelect
                {
                    let templates = VmTemplate::all();
                    let count = templates.len() + 1;
                    form.template_index = (form.template_index + 1) % count;
                    if form.template_index == 0 {
                        form.fields[1].value = "(none)".to_string();
                    } else {
                        let tmpl = &templates[form.template_index - 1];
                        form.fields[1].value = tmpl.name.clone();
                        form.apply_template(tmpl);
                    }
                }
            }
            KeyCode::Enter => {
                // Clone form to avoid borrow issues
                let mut form_clone = self.state.create_vm_form.clone().unwrap();
                if form_clone.validate() {
                    let req = form_clone.to_create_request();
                    let name = req.name.clone();
                    match self.client.create_vm(&req).await {
                        Ok(()) => {
                            self.state.notify_with_level(
                                &format!("Created VM '{name}'"),
                                NotifyLevel::Success,
                            );
                            self.state.add_audit_event("create", &name, "OK");
                            self.state.create_vm_form = None;
                            self.state.input_mode = InputMode::Normal;
                            if self.state.resource_view == ResourceView::VirtualMachines {
                                self.refresh_current_view().await;
                            }
                        }
                        Err(e) => {
                            self.state.notify_with_level(
                                &format!("Error creating VM: {e}"),
                                NotifyLevel::Error,
                            );
                        }
                    }
                } else {
                    // Update form with validation errors
                    self.state.create_vm_form = Some(form_clone);
                }
            }
            KeyCode::Backspace => {
                let field = &mut form.fields[form.focused_field];
                if field.field_type != virtspawn_core::FormFieldType::TemplateSelect {
                    field.value.pop();
                }
            }
            KeyCode::Char(c) => {
                let field = &mut form.fields[form.focused_field];
                if field.field_type != virtspawn_core::FormFieldType::TemplateSelect {
                    field.value.push(c);
                }
            }
            _ => {}
        }
    }

    // ── Mouse handling ───────────────────────────────────────────────────

    fn handle_mouse(&mut self, mouse: MouseEvent) {
        match mouse.kind {
            MouseEventKind::ScrollDown => self.move_down(),
            MouseEventKind::ScrollUp => self.move_up(),
            MouseEventKind::Down(_) => {
                // Click on a row — offset by 2 for tab bar + table header
                if mouse.row > 2 {
                    let clicked = (mouse.row - 2) as usize;
                    let len = self.state.current_list_len();
                    if clicked < len {
                        self.state.selected_index = clicked;
                    }
                }
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

    // ── VM actions (single or batch) ────────────────────────────────────

    async fn vm_action_or_batch(&mut self, action: &str) {
        if self.state.resource_view != ResourceView::VirtualMachines {
            return;
        }

        if self.state.multi_select_mode && !self.state.selected_items.is_empty() {
            self.batch_vm_action(action).await;
        } else {
            self.single_vm_action(action).await;
        }
    }

    async fn single_vm_action(&mut self, action: &str) {
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
                let msg = format!("{action}: '{name}' OK");
                self.state.status_message = msg.clone();
                self.state.notify(&msg);
                self.state.add_audit_event(action, &name, "OK");
                self.refresh_current_view().await;
            }
            Err(e) => {
                let msg = format!("Error {action} '{name}': {e}");
                self.state.add_audit_event(action, &name, &format!("ERROR: {e}"));
                self.state.notify(&msg);
                self.state.status_message = msg;
            }
        }
    }

    async fn batch_vm_action(&mut self, action: &str) {
        let names: Vec<String> = self.state.selected_items.iter().cloned().collect();
        let total = names.len();
        let mut ok = 0;
        let mut errors = 0;

        for name in &names {
            let result = match action {
                "start" => self.client.start_vm(name).await,
                "stop" => self.client.stop_vm(name).await,
                "shutdown" => self.client.shutdown_vm(name).await,
                "reboot" => self.client.reboot_vm(name).await,
                "pause" => self.client.pause_vm(name).await,
                "resume" => self.client.resume_vm(name).await,
                _ => continue,
            };

            match result {
                Ok(()) => {
                    ok += 1;
                    self.state.add_audit_event(action, name, "OK");
                }
                Err(e) => {
                    errors += 1;
                    self.state
                        .add_audit_event(action, name, &format!("ERROR: {e}"));
                }
            }
        }

        self.state.status_message = format!(
            "Batch {action}: {ok}/{total} OK{}",
            if errors > 0 {
                format!(", {errors} failed")
            } else {
                String::new()
            }
        );
        self.state.clear_selection();
        self.refresh_current_view().await;
    }

    async fn request_confirmation(&mut self) {
        let dialog = match self.state.resource_view {
            ResourceView::VirtualMachines => {
                if self.state.multi_select_mode && !self.state.selected_items.is_empty() {
                    let count = self.state.selected_items.len();
                    Some(ConfirmationDialog {
                        title: "Delete VMs".to_string(),
                        message: format!("This will permanently delete {} VMs and their storage.", count),
                        resource_name: format!("{} selected VMs", count),
                        action: format!("batch-delete-vm:{count}"),
                    })
                } else {
                    self.state.selected_vm_name().map(|n| ConfirmationDialog {
                        title: "Delete VM".to_string(),
                        message: "This will permanently delete the VM and its storage.".to_string(),
                        resource_name: n.to_string(),
                        action: format!("delete-vm:{n}"),
                    })
                }
            }
            ResourceView::Snapshots => self.state.selected_snapshot().map(|s| ConfirmationDialog {
                title: "Delete Snapshot".to_string(),
                message: "This will permanently delete the snapshot.".to_string(),
                resource_name: format!("{}/{}", s.vm_name, s.name),
                action: format!("delete-snap:{}:{}", s.vm_name, s.name),
            }),
            _ => None,
        };

        if let Some(d) = dialog {
            self.state.confirm_dialog = Some(d);
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
                        self.state.add_audit_event("delete", name, "OK");
                        self.refresh_current_view().await;
                        self.state.clamp_selection();
                    }
                    Err(e) => {
                        self.state.add_audit_event("delete", name, &format!("ERROR: {e}"));
                        self.state.status_message = format!("Error deleting '{name}': {e}");
                    }
                }
            }
            ["batch-delete-vm", _count] => {
                let names: Vec<String> = self.state.selected_items.iter().cloned().collect();
                let total = names.len();
                let mut ok = 0;
                for name in &names {
                    match self.client.delete_vm(name).await {
                        Ok(()) => {
                            ok += 1;
                            self.state.add_audit_event("delete", name, "OK");
                        }
                        Err(e) => {
                            self.state
                                .add_audit_event("delete", name, &format!("ERROR: {e}"));
                        }
                    }
                }
                self.state.status_message = format!("Batch delete: {ok}/{total} OK");
                self.state.clear_selection();
                self.refresh_current_view().await;
                self.state.clamp_selection();
            }
            ["delete-snap", vm_name, snap_name] => {
                match self.client.delete_snapshot(vm_name, snap_name).await {
                    Ok(()) => {
                        self.state.status_message =
                            format!("Deleted snapshot '{snap_name}' from '{vm_name}'");
                        self.state
                            .add_audit_event("delete-snapshot", snap_name, "OK");
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

    // ── XML view ────────────────────────────────────────────────────────

    async fn show_vm_xml(&mut self) {
        if let Some(name) = self.state.selected_vm_name().map(|s| s.to_string()) {
            match self.client.get_vm_xml(&name).await {
                Ok(xml) => {
                    self.state.xml_content = xml;
                    self.state.scroll_offset = 0;
                    self.state.view_mode = ViewMode::Xml;
                }
                Err(e) => self.state.status_message = format!("Error fetching XML: {e}"),
            }
        }
    }

    // ── Autostart toggle ────────────────────────────────────────────────

    async fn toggle_autostart(&mut self) {
        if let Some(name) = self.state.selected_vm_name().map(|s| s.to_string()) {
            // Get current autostart state
            let current = self
                .client
                .get_vm_details(&name)
                .await
                .map(|d| d.autostart)
                .unwrap_or(false);

            let new_val = !current;
            match self.client.set_autostart(&name, new_val).await {
                Ok(()) => {
                    self.state.status_message = format!(
                        "Autostart for '{name}': {}",
                        if new_val { "enabled" } else { "disabled" }
                    );
                    self.state.add_audit_event(
                        "autostart",
                        &name,
                        if new_val { "enabled" } else { "disabled" },
                    );
                }
                Err(e) => self.state.status_message = format!("Error: {e}"),
            }
        }
    }

    // ── Storage pool actions ────────────────────────────────────────────

    async fn pool_action(&mut self, action: &str) {
        let name = match self.state.selected_pool_name() {
            Some(n) => n.to_string(),
            None => return,
        };

        let result = match action {
            "start" => self.client.start_pool(&name).await,
            "stop" => self.client.stop_pool(&name).await,
            _ => return,
        };

        match result {
            Ok(()) => {
                self.state.status_message = format!("Pool '{name}': {action} OK");
                self.state
                    .add_audit_event(&format!("pool-{action}"), &name, "OK");
                self.refresh_current_view().await;
            }
            Err(e) => self.state.status_message = format!("Error: {e}"),
        }
    }

    // ── Console / Viewer ────────────────────────────────────────────────

    async fn launch_viewer(&mut self) {
        if self.state.resource_view != ResourceView::VirtualMachines {
            return;
        }
        if let Some(name) = self.state.selected_vm_name().map(|s| s.to_string()) {
            self.state.status_message = format!("Launching virt-viewer for '{name}'...");
            self.state.add_audit_event("virt-viewer", &name, "launched");
            let _ = std::process::Command::new("virt-viewer")
                .arg("--connect")
                .arg("qemu:///system")
                .arg(&name)
                .spawn();
        }
    }

    async fn launch_console(&mut self) {
        if self.state.resource_view != ResourceView::VirtualMachines {
            return;
        }
        if let Some(name) = self.state.selected_vm_name().map(|s| s.to_string()) {
            // Try various terminal emulators to open virsh console
            let xfce_cmd = format!("virsh console {name}");
            let terminals: Vec<(&str, Vec<&str>)> = vec![
                ("gnome-terminal", vec!["--", "virsh", "console", &name]),
                ("xfce4-terminal", vec!["-e", &xfce_cmd]),
                ("konsole", vec!["-e", "virsh", "console", &name]),
                ("xterm", vec!["-e", "virsh", "console", &name]),
                ("foot", vec!["virsh", "console", &name]),
                ("alacritty", vec!["-e", "virsh", "console", &name]),
                ("kitty", vec!["virsh", "console", &name]),
            ];

            let mut launched = false;
            for (term, args) in &terminals {
                if std::process::Command::new(term)
                    .args(args)
                    .spawn()
                    .is_ok()
                {
                    self.state.status_message = format!("Opened console for '{name}' in {term}");
                    self.state.add_audit_event("console", &name, term);
                    launched = true;
                    break;
                }
            }

            if !launched {
                self.state.status_message = format!(
                    "No terminal found. Run manually: virsh console {name}"
                );
            }
        }
    }

    // ── Volume browser ───────────────────────────────────────────────────

    async fn browse_pool_volumes(&mut self) {
        if let Some(pool) = self.state.selected_pool_name().map(|s| s.to_string()) {
            match self.client.fetch_volumes(&pool).await {
                Ok(vols) => {
                    self.state.volumes = vols;
                    self.state.browsing_pool = Some(pool.clone());
                    self.state.selected_index = 0;
                    self.state.status_message = format!(
                        "Pool '{}': {} volumes (Backspace to go back)",
                        pool,
                        self.state.volumes.len()
                    );
                }
                Err(e) => self.state.status_message = format!("Error: {e}"),
            }
        }
    }

    // ── Log viewer ──────────────────────────────────────────────────────

    async fn show_vm_logs(&mut self) {
        if let Some(name) = self.state.selected_vm_name().map(|s| s.to_string()) {
            // Try to read qemu log
            let log_paths = [
                format!("/var/log/libvirt/qemu/{name}.log"),
                format!("/var/log/swtpm/libvirt/qemu/{name}-swtpm.log"),
            ];

            let mut content = String::new();
            for path in &log_paths {
                if let Ok(data) = tokio::fs::read_to_string(path).await {
                    if !content.is_empty() {
                        content.push_str("\n\n");
                    }
                    content.push_str(&format!("── {} ──\n", path));
                    // Take last 200 lines
                    let lines: Vec<&str> = data.lines().collect();
                    let start = if lines.len() > 200 { lines.len() - 200 } else { 0 };
                    for line in &lines[start..] {
                        content.push_str(line);
                        content.push('\n');
                    }
                }
            }

            if content.is_empty() {
                content = format!("No logs found for '{name}'.\nChecked:\n");
                for path in &log_paths {
                    content.push_str(&format!("  {path}\n"));
                }
            }

            self.state.log_content = content;
            self.state.scroll_offset = 0;
            self.state.view_mode = ViewMode::Logs;
        }
    }

    // ── noVNC launch ────────────────────────────────────────────────────

    async fn launch_novnc(&mut self) {
        if self.state.resource_view != ResourceView::VirtualMachines {
            return;
        }
        if let Some(name) = self.state.selected_vm_name().map(|s| s.to_string()) {
            match self.client.get_console_info(&name).await {
                Ok(info) => {
                    let ctype = info["console_type"].as_str().unwrap_or("unknown");
                    let port = info["port"].as_i64().unwrap_or(-1);

                    if port <= 0 {
                        self.state.status_message =
                            format!("No VNC/SPICE port for '{name}' (port={port})");
                        return;
                    }

                    // Try to open noVNC in browser
                    let novnc_url = format!(
                        "http://127.0.0.1:6080/vnc.html?host=127.0.0.1&port={port}&autoconnect=true"
                    );

                    // Try xdg-open for any URL
                    if std::process::Command::new("xdg-open")
                        .arg(&novnc_url)
                        .spawn()
                        .is_ok()
                    {
                        self.state.status_message = format!(
                            "Opening noVNC for '{name}' ({ctype} port {port})"
                        );
                    } else {
                        self.state.status_message = format!(
                            "VNC for '{name}': {ctype} on 127.0.0.1:{port}. \
                             Connect with: vncviewer 127.0.0.1:{port}"
                        );
                    }
                    self.state.add_audit_event("novnc", &name, &format!("port {port}"));
                }
                Err(e) => self.state.status_message = format!("Error: {e}"),
            }
        }
    }

    // ── SSH launch ───────────────────────────────────────────────────────

    async fn launch_ssh(&mut self) {
        if self.state.resource_view != ResourceView::VirtualMachines {
            return;
        }
        if let Some(name) = self.state.selected_vm_name().map(|s| s.to_string()) {
            // Try to get the VM's IP from its network interface via virsh domifaddr
            let output = std::process::Command::new("virsh")
                .args(["domifaddr", &name])
                .output();

            let ip = output.ok().and_then(|o| {
                let stdout = String::from_utf8_lossy(&o.stdout);
                // Parse "vnet0  52:54:00:xx:xx:xx  ipv4  192.168.x.x/24"
                stdout.lines().find_map(|line| {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 4 && parts[2] == "ipv4" {
                        Some(parts[3].split('/').next().unwrap_or("").to_string())
                    } else {
                        None
                    }
                })
            });

            if let Some(ip) = ip {
                let terminals = [
                    "gnome-terminal", "xfce4-terminal", "konsole",
                    "xterm", "foot", "alacritty", "kitty",
                ];
                let mut launched = false;
                for term in &terminals {
                    if std::process::Command::new(term)
                        .args(["--", "ssh", &ip])
                        .spawn()
                        .is_ok()
                    {
                        self.state.status_message = format!("SSH to '{name}' ({ip}) in {term}");
                        self.state.add_audit_event("ssh", &name, &ip);
                        launched = true;
                        break;
                    }
                }
                if !launched {
                    self.state.status_message = format!("SSH: ssh {ip}  (no terminal found)");
                }
            } else {
                self.state.status_message = format!("No IP found for '{name}'. Is it running with a network?");
            }
        }
    }

    // ── Snapshot actions ────────────────────────────────────────────────

    async fn revert_snapshot(&mut self) {
        if let Some(snap) = self.state.selected_snapshot().cloned() {
            match self
                .client
                .revert_snapshot(&snap.vm_name, &snap.name)
                .await
            {
                Ok(()) => {
                    self.state.status_message =
                        format!("Reverted '{}' to snapshot '{}'", snap.vm_name, snap.name);
                    self.state
                        .add_audit_event("revert-snapshot", &snap.name, "OK");
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
                self.state
                    .add_audit_event(&format!("network-{action}"), &name, "OK");
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
            ["events"] => self.switch_view(ResourceView::Events).await,
            ["node"] => self.switch_view(ResourceView::Node).await,
            ["snap", vm, name] => {
                match self.client.create_snapshot(vm, name, "").await {
                    Ok(()) => {
                        self.state.status_message =
                            format!("Created snapshot '{name}' for '{vm}'");
                        self.state.add_audit_event("create-snapshot", name, "OK");
                        if self.state.resource_view == ResourceView::Snapshots {
                            self.refresh_current_view().await;
                        }
                    }
                    Err(e) => self.state.status_message = format!("Error: {e}"),
                }
            }
            ["clone", source, new_name] => {
                match self.client.clone_vm(source, new_name).await {
                    Ok(()) => {
                        self.state.status_message =
                            format!("Cloned '{source}' as '{new_name}'");
                        self.state.add_audit_event("clone", source, "OK");
                        if self.state.resource_view == ResourceView::VirtualMachines {
                            self.refresh_current_view().await;
                        }
                    }
                    Err(e) => self.state.status_message = format!("Error: {e}"),
                }
            }
            ["create"] => {
                self.state.create_vm_form = Some(CreateVmForm::new());
                self.state.input_mode = InputMode::CreateVmDialog;
            }
            ["create", name] => {
                let req = CreateVmRequest {
                    name: name.to_string(),
                    ..Default::default()
                };
                match self.client.create_vm(&req).await {
                    Ok(()) => {
                        self.state.status_message = format!("Created VM '{name}'");
                        self.state.add_audit_event("create", name, "OK");
                        if self.state.resource_view == ResourceView::VirtualMachines {
                            self.refresh_current_view().await;
                        }
                    }
                    Err(e) => self.state.status_message = format!("Error: {e}"),
                }
            }
            ["create", name, vcpus, mem] => {
                let req = CreateVmRequest {
                    name: name.to_string(),
                    vcpus: vcpus.parse().unwrap_or(2),
                    memory_mb: mem.parse().unwrap_or(2048),
                    ..Default::default()
                };
                match self.client.create_vm(&req).await {
                    Ok(()) => {
                        self.state.status_message = format!("Created VM '{name}'");
                        self.state.add_audit_event("create", name, "OK");
                        if self.state.resource_view == ResourceView::VirtualMachines {
                            self.refresh_current_view().await;
                        }
                    }
                    Err(e) => self.state.status_message = format!("Error: {e}"),
                }
            }
            ["resize", name, "vcpus", count] => {
                let count: u32 = count.parse().unwrap_or(0);
                match self.client.set_vcpus(name, count).await {
                    Ok(()) => {
                        self.state.status_message =
                            format!("Set vCPUs for '{name}' to {count} (applies on next boot)");
                        self.state.add_audit_event("resize-vcpus", name, &count.to_string());
                    }
                    Err(e) => self.state.status_message = format!("Error: {e}"),
                }
            }
            ["rename", old_name, new_name] => {
                match self.client.rename_vm(old_name, new_name).await {
                    Ok(()) => {
                        self.state.status_message = format!("Renamed '{old_name}' to '{new_name}'");
                        self.state.add_audit_event("rename", old_name, new_name);
                        if self.state.resource_view == ResourceView::VirtualMachines {
                            self.refresh_current_view().await;
                        }
                    }
                    Err(e) => self.state.status_message = format!("Error: {e}"),
                }
            }
            ["netcreate", name] => {
                let req = CreateNetworkRequest {
                    name: name.to_string(),
                    subnet: "192.168.100".to_string(),
                    dhcp_start: "192.168.100.100".to_string(),
                    dhcp_end: "192.168.100.254".to_string(),
                };
                match self.client.create_network(&req).await {
                    Ok(()) => {
                        self.state.status_message = format!("Created network '{name}'");
                        self.state.add_audit_event("create-network", name, "OK");
                        if self.state.resource_view == ResourceView::Networks {
                            self.refresh_current_view().await;
                        }
                    }
                    Err(e) => self.state.status_message = format!("Error: {e}"),
                }
            }
            ["template", tmpl_name, vm_name] => {
                if let Some(tmpl) = VmTemplate::find(tmpl_name) {
                    let req = CreateVmRequest {
                        name: vm_name.to_string(),
                        vcpus: tmpl.vcpus,
                        memory_mb: tmpl.memory_mb,
                        disk_gb: tmpl.disk_gb,
                        os_variant: tmpl.os_variant,
                        ..Default::default()
                    };
                    match self.client.create_vm(&req).await {
                        Ok(()) => {
                            self.state.status_message =
                                format!("Created '{vm_name}' from template '{tmpl_name}'");
                            self.state.add_audit_event("create-from-template", vm_name, tmpl_name);
                            if self.state.resource_view == ResourceView::VirtualMachines {
                                self.refresh_current_view().await;
                            }
                        }
                        Err(e) => self.state.status_message = format!("Error: {e}"),
                    }
                } else {
                    let templates = VmTemplate::all();
                    let names: Vec<&str> = templates.iter().map(|t| t.name.as_str()).collect();
                    self.state.status_message =
                        format!("Unknown template. Available: {}", names.join(", "));
                }
            }
            ["templates"] => {
                let templates = VmTemplate::all();
                let desc: Vec<String> = templates
                    .iter()
                    .map(|t| format!("{}: {}", t.name, t.description))
                    .collect();
                self.state.status_message = desc.join(" | ");
            }
            ["netdelete", name] => {
                match self.client.delete_network(name).await {
                    Ok(()) => {
                        self.state.status_message = format!("Deleted network '{name}'");
                        self.state.add_audit_event("delete-network", name, "OK");
                        if self.state.resource_view == ResourceView::Networks {
                            self.refresh_current_view().await;
                        }
                    }
                    Err(e) => self.state.status_message = format!("Error: {e}"),
                }
            }
            ["resize", name, "memory", mb] => {
                let mb: u64 = mb.parse().unwrap_or(0);
                match self.client.set_memory(name, mb).await {
                    Ok(()) => {
                        self.state.status_message =
                            format!("Set memory for '{name}' to {mb} MB (applies on next boot)");
                        self.state.add_audit_event("resize-memory", name, &format!("{mb}MB"));
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
                        self.connected = true;
                        self.state.connected = true;
                        self.state.vms = vms;
                        self.state.sort_vms();
                        self.state.detect_state_changes();
                        self.state.clamp_selection();
                    }
                    Err(e) => {
                        self.connected = false;
                        self.state.connected = false;
                        self.state.status_message = format!("Error: {e}");
                    }
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
            ResourceView::StoragePools if self.state.browsing_pool.is_some() => {
                let pool = self.state.browsing_pool.clone().unwrap();
                if let Ok(vols) = self.client.fetch_volumes(&pool).await {
                    self.state.volumes = vols;
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
            ResourceView::Events => {
                // Events are local audit trail, no refresh needed
            }
            ResourceView::Node => {
                match self.client.fetch_node_info().await {
                    Ok(info) => self.state.node_info = Some(info),
                    Err(e) => self.state.status_message = format!("Error: {e}"),
                }
            }
        }
    }

    async fn refresh_metrics(&mut self) {
        if let Ok(metrics) = self.client.fetch_metrics().await {
            self.state.vm_metrics = metrics;
            self.state.record_metrics_snapshot();
        }
        self.state.compute_dashboard();
    }
}
