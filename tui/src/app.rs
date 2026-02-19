use crossterm::event::{self, Event, KeyCode, KeyEvent};
use ratatui::DefaultTerminal;
use std::time::{Duration, Instant};

use crate::api::{DaemonClient, VmInfo};
use crate::ui;

pub struct App {
    pub vms: Vec<VmInfo>,
    pub selected: usize,
    pub status_message: String,
    pub should_quit: bool,
    pub confirm_delete: bool,
    client: DaemonClient,
}

impl App {
    pub fn new(client: DaemonClient) -> Self {
        Self {
            vms: Vec::new(),
            selected: 0,
            status_message: "Press 'r' to refresh, 'q' to quit".to_string(),
            should_quit: false,
            confirm_delete: false,
            client,
        }
    }

    pub async fn run(&mut self, mut terminal: DefaultTerminal) -> anyhow::Result<()> {
        self.refresh().await;

        let mut last_refresh = Instant::now();
        let refresh_interval = Duration::from_secs(5);

        while !self.should_quit {
            terminal.draw(|frame| ui::render(frame, self))?;

            if event::poll(Duration::from_millis(250))? {
                if let Event::Key(key) = event::read()? {
                    self.handle_key(key).await;
                }
            }

            if last_refresh.elapsed() >= refresh_interval {
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
                    self.status_message = "Delete cancelled".to_string();
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
                if !self.vms.is_empty() {
                    let name = &self.vms[self.selected].name;
                    self.status_message = format!("Delete VM '{name}'? Press 'y' to confirm, any other key to cancel");
                    self.confirm_delete = true;
                }
            }
            KeyCode::Char('r') => self.refresh().await,
            _ => {}
        }
    }

    fn move_down(&mut self) {
        if !self.vms.is_empty() {
            self.selected = (self.selected + 1) % self.vms.len();
        }
    }

    fn move_up(&mut self) {
        if !self.vms.is_empty() {
            self.selected = if self.selected == 0 {
                self.vms.len() - 1
            } else {
                self.selected - 1
            };
        }
    }

    async fn do_start(&mut self) {
        if let Some(vm) = self.vms.get(self.selected) {
            let name = vm.name.clone();
            match self.client.start_vm(&name).await {
                Ok(()) => {
                    self.status_message = format!("Started VM '{name}'");
                    self.refresh().await;
                }
                Err(e) => self.status_message = format!("Error starting '{name}': {e}"),
            }
        }
    }

    async fn do_stop(&mut self) {
        if let Some(vm) = self.vms.get(self.selected) {
            let name = vm.name.clone();
            match self.client.stop_vm(&name).await {
                Ok(()) => {
                    self.status_message = format!("Stopped VM '{name}'");
                    self.refresh().await;
                }
                Err(e) => self.status_message = format!("Error stopping '{name}': {e}"),
            }
        }
    }

    async fn do_delete(&mut self) {
        if let Some(vm) = self.vms.get(self.selected) {
            let name = vm.name.clone();
            match self.client.delete_vm(&name).await {
                Ok(()) => {
                    self.status_message = format!("Deleted VM '{name}'");
                    self.refresh().await;
                    if self.selected >= self.vms.len() && self.selected > 0 {
                        self.selected -= 1;
                    }
                }
                Err(e) => self.status_message = format!("Error deleting '{name}': {e}"),
            }
        }
    }

    async fn refresh(&mut self) {
        match self.client.fetch_vms().await {
            Ok(vms) => {
                self.vms = vms;
                if self.selected >= self.vms.len() && !self.vms.is_empty() {
                    self.selected = self.vms.len() - 1;
                }
            }
            Err(e) => {
                self.status_message = format!("Error fetching VMs: {e}");
            }
        }
    }
}
