use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VmInfo {
    pub name: String,
    pub state: String,
    pub vcpus: u32,
    pub memory_mb: u64,
}

pub struct AppState {
    pub vms: Vec<VmInfo>,
    pub selected_index: usize,
    pub status_message: String,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            vms: Vec::new(),
            selected_index: 0,
            status_message: "Press 'r' to refresh, 'q' to quit".to_string(),
        }
    }

    pub fn clamp_selection(&mut self) {
        if self.selected_index >= self.vms.len() && !self.vms.is_empty() {
            self.selected_index = self.vms.len() - 1;
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
