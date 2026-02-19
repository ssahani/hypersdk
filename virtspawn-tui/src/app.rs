use crossterm::event::{self, Event, KeyCode, KeyEvent};
use ratatui::DefaultTerminal;
use std::time::{Duration, Instant};

use virtspawn_core::AppState;

use crate::api::DaemonClient;
use crate::ui;

pub struct App {
    pub state: AppState,
    pub should_quit: bool,
    pub confirm_delete: bool,
    client: DaemonClient,
    refresh_interval: Duration,
}

impl App {
    pub fn new(client: DaemonClient, refresh_interval_secs: u64) -> Self {
        Self {
            state: AppState::new(),
            should_quit: false,
            confirm_delete: false,
            client,
            refresh_interval: Duration::from_secs(refresh_interval_secs),
        }
    }

    pub async fn run(&mut self, mut terminal: DefaultTerminal) -> anyhow::Result<()> {
        self.refresh().await;

        let mut last_refresh = Instant::now();

        while !self.should_quit {
            terminal.draw(|frame| ui::render(frame, &self.state, self.confirm_delete))?;

            if event::poll(Duration::from_millis(250))? {
                if let Event::Key(key) = event::read()? {
                    self.handle_key(key).await;
                }
            }

            if last_refresh.elapsed() >= self.refresh_interval {
                self.refresh().await;
                last_refresh = Instant::now();
            }
        }

        Ok(())
    }

    async fn handle_key(&mut self, key: KeyEvent) {
        if self.confirm_delete {
            match key.code {
                KeyCode::Char('y') => {
                    self.confirm_delete = false;
                    self.do_delete().await;
                }
                _ => {
                    self.confirm_delete = false;
                    self.state.status_message = "Delete cancelled".to_string();
                }
            }
            return;
        }

        match key.code {
            KeyCode::Char('q') | KeyCode::Esc => self.should_quit = true,
            KeyCode::Char('j') | KeyCode::Down => self.move_down(),
            KeyCode::Char('k') | KeyCode::Up => self.move_up(),
            KeyCode::Enter | KeyCode::Char('s') => self.do_start().await,
            KeyCode::Char('S') => self.do_stop().await,
            KeyCode::Char('d') => {
                if !self.state.vms.is_empty() {
                    let name = &self.state.vms[self.state.selected_index].name;
                    self.state.status_message =
                        format!("Delete VM '{name}'? Press 'y' to confirm, any other key to cancel");
                    self.confirm_delete = true;
                }
            }
            KeyCode::Char('r') => self.refresh().await,
            _ => {}
        }
    }

    fn move_down(&mut self) {
        if !self.state.vms.is_empty() {
            self.state.selected_index = (self.state.selected_index + 1) % self.state.vms.len();
        }
    }

    fn move_up(&mut self) {
        if !self.state.vms.is_empty() {
            self.state.selected_index = if self.state.selected_index == 0 {
                self.state.vms.len() - 1
            } else {
                self.state.selected_index - 1
            };
        }
    }

    async fn do_start(&mut self) {
        if let Some(vm) = self.state.vms.get(self.state.selected_index) {
            let name = vm.name.clone();
            match self.client.start_vm(&name).await {
                Ok(()) => {
                    self.state.status_message = format!("Started VM '{name}'");
                    self.refresh().await;
                }
                Err(e) => self.state.status_message = format!("Error starting '{name}': {e}"),
            }
        }
    }

    async fn do_stop(&mut self) {
        if let Some(vm) = self.state.vms.get(self.state.selected_index) {
            let name = vm.name.clone();
            match self.client.stop_vm(&name).await {
                Ok(()) => {
                    self.state.status_message = format!("Stopped VM '{name}'");
                    self.refresh().await;
                }
                Err(e) => self.state.status_message = format!("Error stopping '{name}': {e}"),
            }
        }
    }

    async fn do_delete(&mut self) {
        if let Some(vm) = self.state.vms.get(self.state.selected_index) {
            let name = vm.name.clone();
            match self.client.delete_vm(&name).await {
                Ok(()) => {
                    self.state.status_message = format!("Deleted VM '{name}'");
                    self.refresh().await;
                    self.state.clamp_selection();
                }
                Err(e) => self.state.status_message = format!("Error deleting '{name}': {e}"),
            }
        }
    }

    async fn refresh(&mut self) {
        match self.client.fetch_vms().await {
            Ok(vms) => {
                self.state.vms = vms;
                self.state.clamp_selection();
            }
            Err(e) => {
                self.state.status_message = format!("Error fetching VMs: {e}");
            }
        }
    }
}
