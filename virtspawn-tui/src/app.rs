use crossterm::event::{self, Event, KeyCode, KeyEvent, KeyModifiers, MouseEvent, MouseEventKind};
use ratatui::DefaultTerminal;
use std::time::{Duration, Instant};

use virtspawn_core::{
    AppState, ConfirmationDialog, CreateNetworkRequest, CreateVmForm, CreateVmRequest, Focus,
    InputMode, NotifyLevel, ObjectTab, ResourceView, SidebarCategory, SidebarItem, SortColumn,
    SortDirection, ViewMode, VmTemplate,
};

use crate::api::DaemonClient;
use crate::ui;

pub struct App {
    pub state: AppState,
    pub should_quit: bool,
    pub connected: bool,
    client: DaemonClient,
    refresh_interval: Duration,
    sidebar_width: u16,
}

impl App {
    pub fn new(client: DaemonClient, refresh_interval_secs: u64) -> Self {
        Self {
            state: AppState::new(),
            should_quit: false,
            connected: false,
            client,
            refresh_interval: Duration::from_secs(refresh_interval_secs),
            sidebar_width: 24,
        }
    }

    pub async fn run(&mut self, mut terminal: DefaultTerminal) -> anyhow::Result<()> {
        self.state.load_audit_history();
        self.refresh_all_data().await;

        let mut last_refresh = Instant::now();

        while !self.should_quit {
            // Store sidebar width for mouse handling
            let term_width = terminal.get_frame().area().width;
            self.sidebar_width = {
                let w = term_width / 5;
                w.clamp(22, 30)
            };

            terminal.draw(|frame| ui::render(frame, &self.state))?;

            if event::poll(Duration::from_millis(250))? {
                match event::read()? {
                    Event::Key(key) => self.handle_key(key).await,
                    Event::Mouse(mouse) => self.handle_mouse(mouse),
                    _ => {}
                }
            }

            if last_refresh.elapsed() >= self.refresh_interval {
                self.refresh_vms_and_metrics().await;
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

    // ── Normal mode (3-layer dispatch) ──────────────────────────────────

    async fn handle_normal_key(&mut self, key: KeyEvent) {
        // Context menu handling
        if self.state.show_context_menu {
            self.handle_context_menu_key(key).await;
            return;
        }

        // ViewMode overlays (Help, Xml, Logs, Details)
        match self.state.view_mode {
            ViewMode::Help => {
                match key.code {
                    KeyCode::Char('j') | KeyCode::Down => {
                        self.state.help_scroll = self.state.help_scroll.saturating_add(1);
                    }
                    KeyCode::Char('k') | KeyCode::Up => {
                        self.state.help_scroll = self.state.help_scroll.saturating_sub(1);
                    }
                    KeyCode::PageDown => {
                        self.state.help_scroll = self.state.help_scroll.saturating_add(10);
                    }
                    KeyCode::PageUp => {
                        self.state.help_scroll = self.state.help_scroll.saturating_sub(10);
                    }
                    KeyCode::Char('g') => self.state.help_scroll = 0,
                    _ => {
                        self.state.view_mode = ViewMode::Table;
                        self.state.help_scroll = 0;
                    }
                }
                return;
            }
            ViewMode::Details => {
                // Details are now shown inline in the content panel Summary tab.
                // This branch handles legacy escape if somehow entered.
                self.state.view_mode = ViewMode::Table;
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

        // Layer 1: Global keys (any focus)
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
                } else if self.state.command_content_override.is_some() {
                    self.state.command_content_override = None;
                } else {
                    self.should_quit = true;
                }
                return;
            }
            // Help
            KeyCode::Char('?') | KeyCode::F(1) => {
                self.state.view_mode = ViewMode::Help;
                self.state.help_scroll = 0;
                return;
            }
            // Search
            KeyCode::Char('/') => {
                self.state.input_mode = InputMode::Search;
                self.state.search_query.clear();
                self.state.filtered_indices.clear();
                return;
            }
            // Command mode
            KeyCode::Char(':') => {
                self.state.input_mode = InputMode::Command;
                self.state.command_input.clear();
                return;
            }
            // Refresh
            KeyCode::Char('r') => {
                self.refresh_all_data().await;
                return;
            }
            _ => {}
        }

        // Layer 2: Focus switching
        // Note: 'l' on sidebar with a VM selected falls through to show logs
        match key.code {
            KeyCode::Char('h') | KeyCode::Left => {
                if self.state.focus == Focus::Content {
                    self.state.focus = Focus::Sidebar;
                    return;
                }
            }
            KeyCode::Right => {
                if self.state.focus == Focus::Sidebar {
                    self.state.focus = Focus::Content;
                    // Lazy-load VM details when switching to content panel
                    if let Some(SidebarItem::Vm(name)) = self.state.selected_sidebar_item().cloned() {
                        if self.state.vm_details.as_ref().is_none_or(|d| d.name != name) {
                            self.load_vm_details(&name).await;
                        }
                    }
                    return;
                }
            }
            KeyCode::Char('l') => {
                if self.state.focus == Focus::Sidebar {
                    // If on a VM item, let 'l' fall through to sidebar handler for logs
                    if !matches!(self.state.selected_sidebar_item(), Some(SidebarItem::Vm(_))) {
                        self.state.focus = Focus::Content;
                        return;
                    }
                }
            }
            _ => {}
        }

        // Layer 3: Dispatch to focus-specific handler
        match self.state.focus {
            Focus::Sidebar => self.handle_sidebar_key(key).await,
            Focus::Content => self.handle_content_key(key).await,
        }
    }

    // ── Sidebar key handling ────────────────────────────────────────────

    async fn handle_sidebar_key(&mut self, key: KeyEvent) {
        match key.code {
            // Navigate sidebar
            KeyCode::Char('j') | KeyCode::Down => {
                if !self.state.sidebar_items.is_empty() {
                    self.state.sidebar_selected =
                        (self.state.sidebar_selected + 1) % self.state.sidebar_items.len();
                    self.on_sidebar_selection_changed().await;
                }
            }
            KeyCode::Char('k') | KeyCode::Up => {
                if !self.state.sidebar_items.is_empty() {
                    self.state.sidebar_selected = if self.state.sidebar_selected == 0 {
                        self.state.sidebar_items.len() - 1
                    } else {
                        self.state.sidebar_selected - 1
                    };
                    self.on_sidebar_selection_changed().await;
                }
            }
            KeyCode::Char('g') => {
                if !self.state.sidebar_items.is_empty() {
                    self.state.sidebar_selected = 0;
                    self.on_sidebar_selection_changed().await;
                }
            }
            KeyCode::Char('G') => {
                if !self.state.sidebar_items.is_empty() {
                    self.state.sidebar_selected = self.state.sidebar_items.len() - 1;
                    self.on_sidebar_selection_changed().await;
                }
            }
            KeyCode::PageDown => {
                if !self.state.sidebar_items.is_empty() {
                    self.state.sidebar_selected =
                        (self.state.sidebar_selected + 10).min(self.state.sidebar_items.len() - 1);
                    self.on_sidebar_selection_changed().await;
                }
            }
            KeyCode::PageUp => {
                self.state.sidebar_selected = self.state.sidebar_selected.saturating_sub(10);
                self.on_sidebar_selection_changed().await;
            }

            // Collapse/expand category
            KeyCode::Char(' ') => {
                match self.state.selected_sidebar_item().cloned() {
                    Some(SidebarItem::Category(_)) => {
                        self.state.toggle_sidebar_collapse();
                    }
                    Some(SidebarItem::Vm(name)) => {
                        // Multi-select toggle for VMs
                        if self.state.resource_view == ResourceView::VirtualMachines {
                            if !self.state.multi_select_mode {
                                self.state.multi_select_mode = true;
                            }
                            self.state.toggle_selection(&name);
                        }
                    }
                    _ => {}
                }
            }

            // Enter: toggle category or select object and switch to content
            KeyCode::Enter => {
                match self.state.selected_sidebar_item().cloned() {
                    Some(SidebarItem::Category(_)) => {
                        self.state.toggle_sidebar_collapse();
                    }
                    Some(SidebarItem::Vm(name)) => {
                        if self.state.multi_select_mode {
                            self.state.toggle_selection(&name);
                        } else {
                            self.load_vm_details(&name).await;
                            self.state.focus = Focus::Content;
                            self.state.active_object_tab = ObjectTab::Summary;
                        }
                    }
                    Some(SidebarItem::StoragePool(name)) => {
                        self.browse_pool_volumes_by_name(&name).await;
                        self.state.focus = Focus::Content;
                    }
                    Some(SidebarItem::Network(_)) | Some(SidebarItem::Snapshot(_, _)) => {
                        self.state.focus = Focus::Content;
                    }
                    None => {}
                }
            }

            // Backspace: go back from volume browser
            KeyCode::Backspace => {
                if self.state.browsing_pool.is_some() {
                    self.state.browsing_pool = None;
                    self.state.volumes.clear();
                    self.state.selected_index = 0;
                }
            }

            // VM actions from sidebar
            KeyCode::Char('s') => self.action_on_sidebar_item("start").await,
            KeyCode::Char('x') => self.action_on_sidebar_item("stop").await,
            KeyCode::Char('H') if key.modifiers.contains(KeyModifiers::SHIFT) => {
                self.action_on_sidebar_item("shutdown").await;
            }
            KeyCode::Char('b') => self.action_on_sidebar_item("reboot").await,
            KeyCode::Char('p') => self.action_on_sidebar_item("pause").await,
            KeyCode::Char('u') => self.action_on_sidebar_item("resume").await,
            KeyCode::Char('d') => self.request_confirmation_sidebar().await,

            // Create VM dialog
            KeyCode::Char('n') => {
                if matches!(self.state.sidebar_resource_view(), ResourceView::VirtualMachines) {
                    self.state.create_vm_form = Some(CreateVmForm::new());
                    self.state.input_mode = InputMode::CreateVmDialog;
                }
            }

            // Clone hint
            KeyCode::Char('o') => {
                if let Some(SidebarItem::Vm(name)) = self.state.selected_sidebar_item().cloned() {
                    self.state.status_message = format!("Use ':clone {} <new-name>' to clone", name);
                }
            }

            // Viewer/console from sidebar
            KeyCode::Char('v') => {
                if let Some(SidebarItem::Vm(name)) = self.state.selected_sidebar_item().cloned() {
                    self.launch_viewer_by_name(&name).await;
                }
            }
            KeyCode::Char('V') => {
                if let Some(SidebarItem::Vm(name)) = self.state.selected_sidebar_item().cloned() {
                    self.launch_novnc_by_name(&name).await;
                }
            }
            KeyCode::Char('y') => {
                if let Some(SidebarItem::Vm(name)) = self.state.selected_sidebar_item().cloned() {
                    self.show_vm_xml_by_name(&name).await;
                }
            }
            KeyCode::Char('c') => {
                if let Some(SidebarItem::Vm(name)) = self.state.selected_sidebar_item().cloned() {
                    self.launch_console_by_name(&name).await;
                }
            }

            // Log viewer (only reaches here when on a VM; otherwise Layer 2 switches focus)
            KeyCode::Char('l') => {
                if let Some(SidebarItem::Vm(name)) = self.state.selected_sidebar_item().cloned() {
                    self.show_vm_logs_by_name(&name).await;
                }
            }

            // Autostart toggle
            KeyCode::Char('t') => {
                if let Some(SidebarItem::Vm(name)) = self.state.selected_sidebar_item().cloned() {
                    self.toggle_autostart_by_name(&name).await;
                }
            }

            // Network/pool actions
            KeyCode::Char('a') => {
                match self.state.selected_sidebar_item().cloned() {
                    Some(SidebarItem::Network(name)) => self.network_action_by_name("start", &name).await,
                    Some(SidebarItem::StoragePool(name)) => self.pool_action_by_name("start", &name).await,
                    Some(SidebarItem::Category(SidebarCategory::Networks)) => {
                        if let Some(name) = self.state.selected_network_name().map(|s| s.to_string()) {
                            self.network_action_by_name("start", &name).await;
                        }
                    }
                    Some(SidebarItem::Category(SidebarCategory::Storage)) => {
                        if let Some(name) = self.state.selected_pool_name().map(|s| s.to_string()) {
                            self.pool_action_by_name("start", &name).await;
                        }
                    }
                    _ => {}
                }
            }
            KeyCode::Char('z') => {
                match self.state.selected_sidebar_item().cloned() {
                    Some(SidebarItem::Network(name)) => self.network_action_by_name("stop", &name).await,
                    Some(SidebarItem::StoragePool(name)) => self.pool_action_by_name("stop", &name).await,
                    Some(SidebarItem::Category(SidebarCategory::Networks)) => {
                        if let Some(name) = self.state.selected_network_name().map(|s| s.to_string()) {
                            self.network_action_by_name("stop", &name).await;
                        }
                    }
                    Some(SidebarItem::Category(SidebarCategory::Storage)) => {
                        if let Some(name) = self.state.selected_pool_name().map(|s| s.to_string()) {
                            self.pool_action_by_name("stop", &name).await;
                        }
                    }
                    _ => {}
                }
            }

            // Snapshot actions
            KeyCode::Char('R') => {
                if let Some(SidebarItem::Snapshot(vm, snap)) = self.state.selected_sidebar_item().cloned() {
                    self.revert_snapshot_by_name(&vm, &snap).await;
                }
            }

            // Multi-select
            KeyCode::Char('A') if key.modifiers.contains(KeyModifiers::SHIFT) => {
                if matches!(self.state.sidebar_resource_view(), ResourceView::VirtualMachines) {
                    self.state.multi_select_mode = true;
                    self.state.select_all_vms();
                    self.state.status_message = format!("Selected all {} VMs", self.state.selected_items.len());
                }
            }

            // Sort
            KeyCode::Char('N') if key.modifiers.contains(KeyModifiers::SHIFT) => self.toggle_sort(SortColumn::Name),
            KeyCode::Char('S') if key.modifiers.contains(KeyModifiers::SHIFT) => {
                if matches!(self.state.sidebar_resource_view(), ResourceView::VirtualMachines) {
                    self.toggle_sort(SortColumn::State);
                }
            }
            KeyCode::Char('C') if key.modifiers.contains(KeyModifiers::SHIFT) => self.toggle_sort(SortColumn::Cpu),
            KeyCode::Char('M') if key.modifiers.contains(KeyModifiers::SHIFT) => self.toggle_sort(SortColumn::Memory),

            // SSH
            KeyCode::Char('e') => {
                if let Some(SidebarItem::Vm(name)) = self.state.selected_sidebar_item().cloned() {
                    self.launch_ssh_by_name(&name).await;
                }
            }

            _ => {}
        }
    }

    // ── Content key handling ────────────────────────────────────────────

    async fn handle_content_key(&mut self, key: KeyEvent) {
        match key.code {
            // Scroll content
            KeyCode::Char('j') | KeyCode::Down => {
                // If showing a table, navigate rows; otherwise scroll
                if self.is_showing_table() {
                    self.move_down();
                } else {
                    self.state.content_scroll_offset = self.state.content_scroll_offset.saturating_add(1);
                }
            }
            KeyCode::Char('k') | KeyCode::Up => {
                if self.is_showing_table() {
                    self.move_up();
                } else {
                    self.state.content_scroll_offset = self.state.content_scroll_offset.saturating_sub(1);
                }
            }
            KeyCode::PageDown => {
                if self.is_showing_table() {
                    let len = self.state.current_list_len();
                    if len > 0 {
                        self.state.selected_index = (self.state.selected_index + 10).min(len - 1);
                    }
                } else {
                    self.state.content_scroll_offset = self.state.content_scroll_offset.saturating_add(20);
                }
            }
            KeyCode::PageUp => {
                if self.is_showing_table() {
                    self.state.selected_index = self.state.selected_index.saturating_sub(10);
                } else {
                    self.state.content_scroll_offset = self.state.content_scroll_offset.saturating_sub(20);
                }
            }
            KeyCode::Char('g') => {
                if self.is_showing_table() {
                    self.state.selected_index = 0;
                } else {
                    self.state.content_scroll_offset = 0;
                }
            }
            KeyCode::Char('G') => {
                if self.is_showing_table() {
                    let len = self.state.current_list_len();
                    if len > 0 { self.state.selected_index = len - 1; }
                }
            }

            // Sub-tab cycling
            KeyCode::Tab => {
                self.state.active_object_tab = self.state.active_object_tab.next();
                self.state.content_scroll_offset = 0;
            }
            KeyCode::BackTab => {
                self.state.active_object_tab = self.state.active_object_tab.prev();
                self.state.content_scroll_offset = 0;
            }
            // Direct sub-tab selection
            KeyCode::Char('1') => {
                self.state.active_object_tab = ObjectTab::Summary;
                self.state.content_scroll_offset = 0;
            }
            KeyCode::Char('2') => {
                self.state.active_object_tab = ObjectTab::Monitor;
                self.state.content_scroll_offset = 0;
            }
            KeyCode::Char('3') => {
                self.state.active_object_tab = ObjectTab::Configure;
                self.state.content_scroll_offset = 0;
            }

            // Enter: load details for current sidebar item, or browse volumes
            KeyCode::Enter => {
                match self.state.selected_sidebar_item().cloned() {
                    Some(SidebarItem::Vm(name)) => {
                        if self.state.multi_select_mode {
                            self.state.toggle_selection(&name);
                        } else {
                            self.load_vm_details(&name).await;
                        }
                    }
                    Some(SidebarItem::StoragePool(name)) => {
                        self.browse_pool_volumes_by_name(&name).await;
                    }
                    Some(SidebarItem::Category(SidebarCategory::Storage)) => {
                        // Browse selected pool from table
                        if let Some(name) = self.state.selected_pool_name().map(|s| s.to_string()) {
                            self.browse_pool_volumes_by_name(&name).await;
                        }
                    }
                    _ => {}
                }
            }

            // Backspace: go back from volume browser
            KeyCode::Backspace => {
                if self.state.browsing_pool.is_some() {
                    self.state.browsing_pool = None;
                    self.state.volumes.clear();
                    self.state.selected_index = 0;
                }
            }

            // Action keys from content panel (operate on sidebar-selected item)
            KeyCode::Char('s') => self.action_on_sidebar_item("start").await,
            KeyCode::Char('x') => self.action_on_sidebar_item("stop").await,
            KeyCode::Char('H') if key.modifiers.contains(KeyModifiers::SHIFT) => {
                self.action_on_sidebar_item("shutdown").await;
            }
            KeyCode::Char('b') => self.action_on_sidebar_item("reboot").await,
            KeyCode::Char('p') => self.action_on_sidebar_item("pause").await,
            KeyCode::Char('u') => self.action_on_sidebar_item("resume").await,
            KeyCode::Char('d') => self.request_confirmation_sidebar().await,

            // VM-specific content actions (use effective_vm_name for table+sidebar)
            KeyCode::Char('n') => {
                if matches!(self.state.sidebar_resource_view(), ResourceView::VirtualMachines) {
                    self.state.create_vm_form = Some(CreateVmForm::new());
                    self.state.input_mode = InputMode::CreateVmDialog;
                }
            }
            KeyCode::Char('o') => {
                if let Some(name) = self.state.effective_vm_name().map(|s| s.to_string()) {
                    self.state.status_message = format!("Use ':clone {} <new-name>' to clone", name);
                }
            }
            KeyCode::Char('v') => {
                if let Some(name) = self.state.effective_vm_name().map(|s| s.to_string()) {
                    self.launch_viewer_by_name(&name).await;
                }
            }
            KeyCode::Char('V') => {
                if let Some(name) = self.state.effective_vm_name().map(|s| s.to_string()) {
                    self.launch_novnc_by_name(&name).await;
                }
            }
            KeyCode::Char('y') => {
                if let Some(name) = self.state.effective_vm_name().map(|s| s.to_string()) {
                    self.show_vm_xml_by_name(&name).await;
                }
            }
            KeyCode::Char('c') => {
                if let Some(name) = self.state.effective_vm_name().map(|s| s.to_string()) {
                    self.launch_console_by_name(&name).await;
                }
            }
            KeyCode::Char('t') => {
                if let Some(name) = self.state.effective_vm_name().map(|s| s.to_string()) {
                    self.toggle_autostart_by_name(&name).await;
                }
            }
            KeyCode::Char('e') => {
                if let Some(name) = self.state.effective_vm_name().map(|s| s.to_string()) {
                    self.launch_ssh_by_name(&name).await;
                }
            }

            // Network/pool actions
            KeyCode::Char('a') => {
                match self.state.selected_sidebar_item().cloned() {
                    Some(SidebarItem::Network(name)) => self.network_action_by_name("start", &name).await,
                    Some(SidebarItem::StoragePool(name)) => self.pool_action_by_name("start", &name).await,
                    Some(SidebarItem::Category(SidebarCategory::Networks)) => {
                        if let Some(name) = self.state.selected_network_name().map(|s| s.to_string()) {
                            self.network_action_by_name("start", &name).await;
                        }
                    }
                    Some(SidebarItem::Category(SidebarCategory::Storage)) => {
                        if let Some(name) = self.state.selected_pool_name().map(|s| s.to_string()) {
                            self.pool_action_by_name("start", &name).await;
                        }
                    }
                    _ => {}
                }
            }
            KeyCode::Char('z') => {
                match self.state.selected_sidebar_item().cloned() {
                    Some(SidebarItem::Network(name)) => self.network_action_by_name("stop", &name).await,
                    Some(SidebarItem::StoragePool(name)) => self.pool_action_by_name("stop", &name).await,
                    Some(SidebarItem::Category(SidebarCategory::Networks)) => {
                        if let Some(name) = self.state.selected_network_name().map(|s| s.to_string()) {
                            self.network_action_by_name("stop", &name).await;
                        }
                    }
                    Some(SidebarItem::Category(SidebarCategory::Storage)) => {
                        if let Some(name) = self.state.selected_pool_name().map(|s| s.to_string()) {
                            self.pool_action_by_name("stop", &name).await;
                        }
                    }
                    _ => {}
                }
            }

            // Snapshot actions
            KeyCode::Char('R') => {
                if let Some(snap) = self.state.effective_snapshot().cloned() {
                    self.revert_snapshot_by_name(&snap.vm_name, &snap.name).await;
                }
            }

            // Multi-select
            KeyCode::Char(' ') => {
                if let Some(SidebarItem::Vm(name)) = self.state.selected_sidebar_item().cloned() {
                    if !self.state.multi_select_mode {
                        self.state.multi_select_mode = true;
                    }
                    self.state.toggle_selection(&name);
                }
            }
            KeyCode::Char('A') if key.modifiers.contains(KeyModifiers::SHIFT) => {
                if matches!(self.state.sidebar_resource_view(), ResourceView::VirtualMachines) {
                    self.state.multi_select_mode = true;
                    self.state.select_all_vms();
                    self.state.status_message = format!("Selected all {} VMs", self.state.selected_items.len());
                }
            }

            // Sort
            KeyCode::Char('N') if key.modifiers.contains(KeyModifiers::SHIFT) => self.toggle_sort(SortColumn::Name),
            KeyCode::Char('S') if key.modifiers.contains(KeyModifiers::SHIFT) => {
                if matches!(self.state.sidebar_resource_view(), ResourceView::VirtualMachines) {
                    self.toggle_sort(SortColumn::State);
                }
            }
            KeyCode::Char('C') if key.modifiers.contains(KeyModifiers::SHIFT) => self.toggle_sort(SortColumn::Cpu),
            KeyCode::Char('M') if key.modifiers.contains(KeyModifiers::SHIFT) => self.toggle_sort(SortColumn::Memory),

            _ => {}
        }
    }

    /// Whether the current sidebar selection shows a table in the content panel
    fn is_showing_table(&self) -> bool {
        matches!(
            self.state.selected_sidebar_item(),
            Some(SidebarItem::Category(_))
        ) || self.state.command_content_override.is_some()
    }

    // ── Sidebar selection changed ───────────────────────────────────────

    async fn on_sidebar_selection_changed(&mut self) {
        self.state.content_scroll_offset = 0;
        self.state.command_content_override = None;

        // Update resource_view to match sidebar
        self.state.resource_view = self.state.sidebar_resource_view();
        self.state.selected_index = 0;

        // Clear stale details if selected VM changed
        if let Some(SidebarItem::Vm(name)) = self.state.selected_sidebar_item().cloned() {
            // Keep cached details if they match the selected VM
            if let Some(ref d) = self.state.vm_details {
                if d.name != name {
                    self.state.vm_details = None;
                }
            }
        } else {
            // Not on a VM item - don't clear details (may switch back)
        }
    }

    // ── Action dispatch based on sidebar item ───────────────────────────

    async fn action_on_sidebar_item(&mut self, action: &str) {
        match self.state.selected_sidebar_item().cloned() {
            Some(SidebarItem::Vm(name)) => {
                if self.state.multi_select_mode && !self.state.selected_items.is_empty() {
                    self.batch_vm_action(action).await;
                } else {
                    self.single_vm_action_by_name(action, &name).await;
                }
            }
            Some(SidebarItem::Category(SidebarCategory::VirtualMachines)) => {
                // Action on selected VM in the table
                if self.state.multi_select_mode && !self.state.selected_items.is_empty() {
                    self.batch_vm_action(action).await;
                } else if let Some(name) = self.state.selected_vm_name().map(|s| s.to_string()) {
                    self.single_vm_action_by_name(action, &name).await;
                }
            }
            Some(SidebarItem::Network(name)) => {
                match action {
                    "start" => self.network_action_by_name("start", &name).await,
                    "stop" => self.network_action_by_name("stop", &name).await,
                    _ => {}
                }
            }
            Some(SidebarItem::StoragePool(name)) => {
                match action {
                    "start" => self.pool_action_by_name("start", &name).await,
                    "stop" => self.pool_action_by_name("stop", &name).await,
                    _ => {}
                }
            }
            _ => {}
        }
    }

    // ── Context menu ────────────────────────────────────────────────────

    async fn handle_context_menu_key(&mut self, key: KeyEvent) {
        self.state.show_context_menu = false;
        match key.code {
            KeyCode::Char('s') => self.action_on_sidebar_item("start").await,
            KeyCode::Char('x') => self.action_on_sidebar_item("stop").await,
            KeyCode::Char('h') => self.action_on_sidebar_item("shutdown").await,
            KeyCode::Char('b') => self.action_on_sidebar_item("reboot").await,
            KeyCode::Char('p') => self.action_on_sidebar_item("pause").await,
            KeyCode::Char('u') => self.action_on_sidebar_item("resume").await,
            KeyCode::Char('d') => self.request_confirmation_sidebar().await,
            KeyCode::Char('o') => {
                if let Some(name) = self.state.effective_vm_name().map(|s| s.to_string()) {
                    self.state.status_message = format!("Use ':clone {} <new-name>' to clone", name);
                }
            }
            KeyCode::Char('v') => {
                if let Some(name) = self.state.effective_vm_name().map(|s| s.to_string()) {
                    self.launch_viewer_by_name(&name).await;
                }
            }
            KeyCode::Char('c') => {
                if let Some(name) = self.state.effective_vm_name().map(|s| s.to_string()) {
                    self.launch_console_by_name(&name).await;
                }
            }
            KeyCode::Char('y') => {
                if let Some(name) = self.state.effective_vm_name().map(|s| s.to_string()) {
                    self.show_vm_xml_by_name(&name).await;
                }
            }
            KeyCode::Char('n') => {
                if matches!(self.state.sidebar_resource_view(), ResourceView::VirtualMachines) {
                    self.state.create_vm_form = Some(CreateVmForm::new());
                    self.state.input_mode = InputMode::CreateVmDialog;
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

    // ── Create VM dialog ────────────────────────────────────────────────

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
                    let count = templates.len() + 1;
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
                            self.refresh_all_data().await;
                        }
                        Err(e) => {
                            self.state.notify_with_level(
                                &format!("Error creating VM: {e}"),
                                NotifyLevel::Error,
                            );
                        }
                    }
                } else {
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

    // ── Mouse handling ──────────────────────────────────────────────────

    fn handle_mouse(&mut self, mouse: MouseEvent) {
        match mouse.kind {
            MouseEventKind::ScrollDown => {
                if mouse.column < self.sidebar_width {
                    // Scroll sidebar
                    if !self.state.sidebar_items.is_empty() {
                        self.state.sidebar_selected =
                            (self.state.sidebar_selected + 1).min(self.state.sidebar_items.len() - 1);
                    }
                } else {
                    // Scroll content
                    if self.is_showing_table() {
                        self.move_down();
                    } else {
                        self.state.content_scroll_offset = self.state.content_scroll_offset.saturating_add(1);
                    }
                }
            }
            MouseEventKind::ScrollUp => {
                if mouse.column < self.sidebar_width {
                    self.state.sidebar_selected = self.state.sidebar_selected.saturating_sub(1);
                } else if self.is_showing_table() {
                    self.move_up();
                } else {
                    self.state.content_scroll_offset = self.state.content_scroll_offset.saturating_sub(1);
                }
            }
            MouseEventKind::Down(_) => {
                if mouse.column < self.sidebar_width {
                    // Click in sidebar
                    self.state.focus = Focus::Sidebar;
                    // Offset by 2 for border + title
                    if mouse.row > 1 {
                        let clicked = (mouse.row - 2) as usize;
                        if clicked < self.state.sidebar_items.len() {
                            self.state.sidebar_selected = clicked;
                        }
                    }
                } else {
                    // Click in content
                    self.state.focus = Focus::Content;
                    if mouse.row > 2 {
                        let clicked = (mouse.row - 3) as usize;
                        let len = self.state.current_list_len();
                        if clicked < len {
                            self.state.selected_index = clicked;
                        }
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

    fn toggle_sort(&mut self, col: SortColumn) {
        if self.state.sort_column == col {
            self.state.sort_direction = self.state.sort_direction.toggle();
        } else {
            self.state.sort_column = col;
            self.state.sort_direction = SortDirection::Ascending;
        }
        self.state.sort_vms();
        self.state.rebuild_sidebar();
    }

    // ── VM actions by name ──────────────────────────────────────────────

    async fn single_vm_action_by_name(&mut self, action: &str, name: &str) {
        let result = match action {
            "start" => self.client.start_vm(name).await,
            "stop" => self.client.stop_vm(name).await,
            "shutdown" => self.client.shutdown_vm(name).await,
            "reboot" => self.client.reboot_vm(name).await,
            "pause" => self.client.pause_vm(name).await,
            "resume" => self.client.resume_vm(name).await,
            _ => return,
        };

        match result {
            Ok(()) => {
                let msg = format!("{action}: '{name}' OK");
                self.state.status_message = msg.clone();
                self.state.notify(&msg);
                self.state.add_audit_event(action, name, "OK");
                self.refresh_vms_and_metrics().await;
            }
            Err(e) => {
                let msg = format!("Error {action} '{name}': {e}");
                self.state.add_audit_event(action, name, &format!("ERROR: {e}"));
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
                    self.state.add_audit_event(action, name, &format!("ERROR: {e}"));
                }
            }
        }

        self.state.status_message = format!(
            "Batch {action}: {ok}/{total} OK{}",
            if errors > 0 { format!(", {errors} failed") } else { String::new() }
        );
        self.state.clear_selection();
        self.refresh_vms_and_metrics().await;
    }

    async fn request_confirmation_sidebar(&mut self) {
        let dialog = match self.state.selected_sidebar_item().cloned() {
            Some(SidebarItem::Vm(name)) => {
                if self.state.multi_select_mode && !self.state.selected_items.is_empty() {
                    let count = self.state.selected_items.len();
                    Some(ConfirmationDialog {
                        title: "Delete VMs".to_string(),
                        message: format!("This will permanently delete {} VMs and their storage.", count),
                        resource_name: format!("{} selected VMs", count),
                        action: format!("batch-delete-vm:{count}"),
                    })
                } else {
                    Some(ConfirmationDialog {
                        title: "Delete VM".to_string(),
                        message: "This will permanently delete the VM and its storage.".to_string(),
                        resource_name: name.clone(),
                        action: format!("delete-vm:{name}"),
                    })
                }
            }
            Some(SidebarItem::Category(SidebarCategory::VirtualMachines)) => {
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
            Some(SidebarItem::Snapshot(vm, snap)) => {
                Some(ConfirmationDialog {
                    title: "Delete Snapshot".to_string(),
                    message: "This will permanently delete the snapshot.".to_string(),
                    resource_name: format!("{vm}/{snap}"),
                    action: format!("delete-snap:{vm}:{snap}"),
                })
            }
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
                        self.state.vm_details = None;
                        self.refresh_vms_and_metrics().await;
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
                            self.state.add_audit_event("delete", name, &format!("ERROR: {e}"));
                        }
                    }
                }
                self.state.status_message = format!("Batch delete: {ok}/{total} OK");
                self.state.clear_selection();
                self.state.vm_details = None;
                self.refresh_vms_and_metrics().await;
            }
            ["delete-snap", vm_name, snap_name] => {
                match self.client.delete_snapshot(vm_name, snap_name).await {
                    Ok(()) => {
                        self.state.status_message = format!("Deleted snapshot '{snap_name}' from '{vm_name}'");
                        self.state.add_audit_event("delete-snapshot", snap_name, "OK");
                        self.refresh_all_data().await;
                    }
                    Err(e) => self.state.status_message = format!("Error: {e}"),
                }
            }
            _ => {}
        }
    }

    // ── VM detail loading ───────────────────────────────────────────────

    async fn load_vm_details(&mut self, name: &str) {
        match self.client.get_vm_details(name).await {
            Ok(details) => {
                self.state.vm_details = Some(details);
            }
            Err(e) => {
                self.state.status_message = format!("Error fetching details: {e}");
            }
        }
    }

    // ── Autostart toggle ────────────────────────────────────────────────

    async fn toggle_autostart_by_name(&mut self, name: &str) {
        let current = self.client.get_vm_details(name).await
            .map(|d| d.autostart)
            .unwrap_or(false);

        let new_val = !current;
        match self.client.set_autostart(name, new_val).await {
            Ok(()) => {
                self.state.status_message = format!(
                    "Autostart for '{name}': {}",
                    if new_val { "enabled" } else { "disabled" }
                );
                self.state.add_audit_event("autostart", name, if new_val { "enabled" } else { "disabled" });
            }
            Err(e) => self.state.status_message = format!("Error: {e}"),
        }
    }

    // ── Network actions by name ─────────────────────────────────────────

    async fn network_action_by_name(&mut self, action: &str, name: &str) {
        let result = match action {
            "start" => self.client.start_network(name).await,
            "stop" => self.client.stop_network(name).await,
            _ => return,
        };

        match result {
            Ok(()) => {
                self.state.status_message = format!("Network '{name}': {action} OK");
                self.state.add_audit_event(&format!("network-{action}"), name, "OK");
                self.refresh_all_data().await;
            }
            Err(e) => self.state.status_message = format!("Error: {e}"),
        }
    }

    // ── Pool actions by name ────────────────────────────────────────────

    async fn pool_action_by_name(&mut self, action: &str, name: &str) {
        let result = match action {
            "start" => self.client.start_pool(name).await,
            "stop" => self.client.stop_pool(name).await,
            _ => return,
        };

        match result {
            Ok(()) => {
                self.state.status_message = format!("Pool '{name}': {action} OK");
                self.state.add_audit_event(&format!("pool-{action}"), name, "OK");
                self.refresh_all_data().await;
            }
            Err(e) => self.state.status_message = format!("Error: {e}"),
        }
    }

    // ── Snapshot actions by name ────────────────────────────────────────

    async fn revert_snapshot_by_name(&mut self, vm_name: &str, snap_name: &str) {
        match self.client.revert_snapshot(vm_name, snap_name).await {
            Ok(()) => {
                self.state.status_message = format!("Reverted '{}' to snapshot '{}'", vm_name, snap_name);
                self.state.add_audit_event("revert-snapshot", snap_name, "OK");
                self.refresh_all_data().await;
            }
            Err(e) => self.state.status_message = format!("Error reverting: {e}"),
        }
    }

    // ── Volume browser ──────────────────────────────────────────────────

    async fn browse_pool_volumes_by_name(&mut self, pool: &str) {
        match self.client.fetch_volumes(pool).await {
            Ok(vols) => {
                self.state.volumes = vols;
                self.state.browsing_pool = Some(pool.to_string());
                self.state.selected_index = 0;
                self.state.status_message = format!(
                    "Pool '{}': {} volumes (Backspace to go back)",
                    pool, self.state.volumes.len()
                );
            }
            Err(e) => self.state.status_message = format!("Error: {e}"),
        }
    }

    // ── Console / Viewer by name ───────────────────────────────────────

    async fn launch_viewer_by_name(&mut self, name: &str) {
        self.state.status_message = format!("Launching virt-viewer for '{name}'...");
        self.state.add_audit_event("virt-viewer", name, "launched");
        let _ = std::process::Command::new("virt-viewer")
            .arg("--connect")
            .arg("qemu:///system")
            .arg(name)
            .spawn();
    }

    async fn launch_console_by_name(&mut self, name: &str) {
        let xfce_cmd = format!("virsh console {name}");
        let terminals: Vec<(&str, Vec<&str>)> = vec![
            ("gnome-terminal", vec!["--", "virsh", "console", name]),
            ("xfce4-terminal", vec!["-e", &xfce_cmd]),
            ("konsole", vec!["-e", "virsh", "console", name]),
            ("xterm", vec!["-e", "virsh", "console", name]),
            ("foot", vec!["virsh", "console", name]),
            ("alacritty", vec!["-e", "virsh", "console", name]),
            ("kitty", vec!["virsh", "console", name]),
        ];

        let mut launched = false;
        for (term, args) in &terminals {
            if std::process::Command::new(term).args(args).spawn().is_ok() {
                self.state.status_message = format!("Opened console for '{name}' in {term}");
                self.state.add_audit_event("console", name, term);
                launched = true;
                break;
            }
        }

        if !launched {
            self.state.status_message = format!("No terminal found. Run manually: virsh console {name}");
        }
    }

    async fn launch_novnc_by_name(&mut self, name: &str) {
        match self.client.get_console_info(name).await {
            Ok(info) => {
                let ctype = info["console_type"].as_str().unwrap_or("unknown");
                let port = info["port"].as_i64().unwrap_or(-1);
                let ws_port = info["websocket_port"].as_i64().unwrap_or(-1);

                if port <= 0 {
                    self.state.status_message = format!("No VNC/SPICE port for '{name}' (port={port})");
                    return;
                }

                let connect_port = if ws_port > 0 { ws_port } else { port };
                let novnc_url = format!(
                    "http://127.0.0.1:6080/vnc.html?host=127.0.0.1&port={connect_port}&autoconnect=true"
                );

                if std::process::Command::new("xdg-open").arg(&novnc_url).spawn().is_ok() {
                    self.state.status_message = format!("Opening noVNC for '{name}' ({ctype} port {connect_port})");
                } else {
                    self.state.status_message = format!(
                        "VNC for '{name}': {ctype} on 127.0.0.1:{port}. Connect with: vncviewer 127.0.0.1:{port}"
                    );
                }
                self.state.add_audit_event("novnc", name, &format!("port {connect_port}"));
            }
            Err(e) => self.state.status_message = format!("Error: {e}"),
        }
    }

    async fn show_vm_xml_by_name(&mut self, name: &str) {
        match self.client.get_vm_xml(name).await {
            Ok(xml) => {
                self.state.xml_content = xml;
                self.state.scroll_offset = 0;
                self.state.view_mode = ViewMode::Xml;
            }
            Err(e) => self.state.status_message = format!("Error fetching XML: {e}"),
        }
    }

    // ── Log viewer ──────────────────────────────────────────────────────

    async fn show_vm_logs_by_name(&mut self, name: &str) {
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
                content.push_str(&format!("\u{2500}\u{2500} {} \u{2500}\u{2500}\n", path));
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

    // ── SSH launch ──────────────────────────────────────────────────────

    async fn launch_ssh_by_name(&mut self, name: &str) {
        let output = std::process::Command::new("virsh")
            .args(["domifaddr", name])
            .output();

        let ip = output.ok().and_then(|o| {
            let stdout = String::from_utf8_lossy(&o.stdout);
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
                    self.state.add_audit_event("ssh", name, &ip);
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

    // ── Command execution ───────────────────────────────────────────────

    async fn execute_command(&mut self, cmd: &str) {
        let parts: Vec<&str> = cmd.split_whitespace().collect();
        match parts.as_slice() {
            ["vms"] => {
                self.state.command_content_override = None;
                // Find VMs category in sidebar and select it
                self.select_sidebar_category(SidebarCategory::VirtualMachines);
            }
            ["net"] | ["networks"] => {
                self.state.command_content_override = None;
                self.select_sidebar_category(SidebarCategory::Networks);
            }
            ["pool"] | ["storage"] => {
                self.state.command_content_override = None;
                self.select_sidebar_category(SidebarCategory::Storage);
            }
            ["snap"] | ["snapshots"] => {
                self.state.command_content_override = None;
                self.select_sidebar_category(SidebarCategory::Snapshots);
            }
            ["events"] => {
                self.state.command_content_override = Some(ResourceView::Events);
                self.state.resource_view = ResourceView::Events;
            }
            ["node"] => {
                self.state.command_content_override = Some(ResourceView::Node);
                self.state.resource_view = ResourceView::Node;
                if self.state.node_info.is_none() {
                    if let Ok(info) = self.client.fetch_node_info().await {
                        self.state.node_info = Some(info);
                    }
                }
            }
            ["snap", vm, name] => {
                match self.client.create_snapshot(vm, name, "").await {
                    Ok(()) => {
                        self.state.status_message = format!("Created snapshot '{name}' for '{vm}'");
                        self.state.add_audit_event("create-snapshot", name, "OK");
                        self.refresh_all_data().await;
                    }
                    Err(e) => self.state.status_message = format!("Error: {e}"),
                }
            }
            ["clone", source, new_name] => {
                match self.client.clone_vm(source, new_name).await {
                    Ok(()) => {
                        self.state.status_message = format!("Cloned '{source}' as '{new_name}'");
                        self.state.add_audit_event("clone", source, "OK");
                        self.refresh_all_data().await;
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
                        self.refresh_all_data().await;
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
                        self.refresh_all_data().await;
                    }
                    Err(e) => self.state.status_message = format!("Error: {e}"),
                }
            }
            ["resize", name, "vcpus", count] => {
                let count: u32 = count.parse().unwrap_or(0);
                match self.client.set_vcpus(name, count).await {
                    Ok(()) => {
                        self.state.status_message = format!("Set vCPUs for '{name}' to {count} (applies on next boot)");
                        self.state.add_audit_event("resize-vcpus", name, &count.to_string());
                    }
                    Err(e) => self.state.status_message = format!("Error: {e}"),
                }
            }
            ["resize", name, "memory", mb] => {
                let mb: u64 = mb.parse().unwrap_or(0);
                match self.client.set_memory(name, mb).await {
                    Ok(()) => {
                        self.state.status_message = format!("Set memory for '{name}' to {mb} MB (applies on next boot)");
                        self.state.add_audit_event("resize-memory", name, &format!("{mb}MB"));
                    }
                    Err(e) => self.state.status_message = format!("Error: {e}"),
                }
            }
            ["rename", old_name, new_name] => {
                match self.client.rename_vm(old_name, new_name).await {
                    Ok(()) => {
                        self.state.status_message = format!("Renamed '{old_name}' to '{new_name}'");
                        self.state.add_audit_event("rename", old_name, new_name);
                        self.refresh_all_data().await;
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
                        self.refresh_all_data().await;
                    }
                    Err(e) => self.state.status_message = format!("Error: {e}"),
                }
            }
            ["netdelete", name] => {
                match self.client.delete_network(name).await {
                    Ok(()) => {
                        self.state.status_message = format!("Deleted network '{name}'");
                        self.state.add_audit_event("delete-network", name, "OK");
                        self.refresh_all_data().await;
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
                            self.state.status_message = format!("Created '{vm_name}' from template '{tmpl_name}'");
                            self.state.add_audit_event("create-from-template", vm_name, tmpl_name);
                            self.refresh_all_data().await;
                        }
                        Err(e) => self.state.status_message = format!("Error: {e}"),
                    }
                } else {
                    let templates = VmTemplate::all();
                    let names: Vec<&str> = templates.iter().map(|t| t.name.as_str()).collect();
                    self.state.status_message = format!("Unknown template. Available: {}", names.join(", "));
                }
            }
            ["templates"] => {
                let templates = VmTemplate::all();
                let desc: Vec<String> = templates.iter()
                    .map(|t| format!("{}: {}", t.name, t.description))
                    .collect();
                self.state.status_message = desc.join(" | ");
            }
            ["q"] | ["quit"] => self.should_quit = true,
            _ => {
                self.state.status_message = format!("Unknown command: {cmd}");
            }
        }
    }

    fn select_sidebar_category(&mut self, cat: SidebarCategory) {
        for (i, item) in self.state.sidebar_items.iter().enumerate() {
            if *item == SidebarItem::Category(cat) {
                self.state.sidebar_selected = i;
                break;
            }
        }
        self.state.resource_view = self.state.sidebar_resource_view();
        self.state.selected_index = 0;
        self.state.content_scroll_offset = 0;
    }

    // ── Refresh all data ────────────────────────────────────────────────

    async fn refresh_all_data(&mut self) {
        // VMs
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

        // Networks
        if let Ok(nets) = self.client.fetch_networks().await {
            self.state.networks = nets;
        }

        // Storage pools
        if let Ok(pools) = self.client.fetch_storage_pools().await {
            self.state.storage_pools = pools;
        }

        // Snapshots
        if let Ok(snaps) = self.client.fetch_all_snapshots().await {
            self.state.snapshots = snaps;
        }

        // Node info
        if let Ok(info) = self.client.fetch_node_info().await {
            self.state.node_info = Some(info);
        }

        // Metrics
        if let Ok(metrics) = self.client.fetch_metrics().await {
            self.state.vm_metrics = metrics;
            self.state.record_metrics_snapshot();
        }

        // Refresh volumes if browsing a pool
        if let Some(pool) = self.state.browsing_pool.clone() {
            if let Ok(vols) = self.client.fetch_volumes(&pool).await {
                self.state.volumes = vols;
            }
        }

        self.state.compute_dashboard();
        self.state.rebuild_sidebar();
        self.state.clamp_selection();
    }

    /// Lighter refresh that only fetches VMs and metrics (for VM lifecycle actions)
    async fn refresh_vms_and_metrics(&mut self) {
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

        if let Ok(metrics) = self.client.fetch_metrics().await {
            self.state.vm_metrics = metrics;
            self.state.record_metrics_snapshot();
        }

        self.state.compute_dashboard();
        self.state.rebuild_sidebar();
    }
}
