use serde::{Deserialize, Serialize};

// ── VM Types ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VmInfo {
    pub name: String,
    pub state: String,
    pub vcpus: u32,
    pub memory_mb: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VmDetails {
    pub name: String,
    pub uuid: String,
    pub state: String,
    pub vcpus: u32,
    pub memory_mb: u64,
    pub os_type: String,
    pub arch: String,
    pub autostart: bool,
    pub persistent: bool,
    pub interfaces: Vec<InterfaceInfo>,
    pub disks: Vec<DiskInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InterfaceInfo {
    pub mac_address: String,
    pub source: String,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskInfo {
    pub device: String,
    pub source: String,
    pub driver: String,
    pub target: String,
}

// ── Snapshot Types ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotInfo {
    pub name: String,
    pub vm_name: String,
    pub creation_time: i64,
    pub state: String,
    pub description: String,
    pub parent: String,
    pub is_current: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSnapshotRequest {
    pub name: String,
    #[serde(default)]
    pub description: String,
}

// ── Network Types ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkInfo {
    pub name: String,
    pub uuid: String,
    pub active: bool,
    pub persistent: bool,
    pub autostart: bool,
    pub bridge: String,
}

// ── Storage Types ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoragePoolInfo {
    pub name: String,
    pub uuid: String,
    pub state: String,
    pub capacity_gb: f64,
    pub allocation_gb: f64,
    pub available_gb: f64,
    pub autostart: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageVolumeInfo {
    pub name: String,
    pub pool: String,
    pub capacity_gb: f64,
    pub allocation_gb: f64,
    pub path: String,
    pub vol_type: String,
}

// ── Node / Host Types ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeInfo {
    pub hostname: String,
    pub hypervisor: String,
    pub hypervisor_version: String,
    pub lib_version: String,
    pub cpu_model: String,
    pub cpu_cores: u32,
    pub cpu_threads: u32,
    pub cpu_sockets: u32,
    pub memory_mb: u64,
    pub numa_nodes: u32,
    pub active_vms: u32,
    pub defined_vms: u32,
}

// ── Metrics Types ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VmMetrics {
    pub name: String,
    pub cpu_time_ns: u64,
    pub vcpus: u32,
    pub memory_total_mb: u64,
    pub memory_used_mb: u64,
    pub memory_pct: f64,
}

// ── Audit / Event Types ─────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    pub timestamp: String,
    pub action: String,
    pub target: String,
    pub result: String,
}

// ── Clone Request ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloneVmRequest {
    pub new_name: String,
}

// ── TUI State ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResourceView {
    VirtualMachines,
    Networks,
    StoragePools,
    Snapshots,
    Events,
    Node,
}

impl ResourceView {
    pub fn label(&self) -> &'static str {
        match self {
            Self::VirtualMachines => "VMs",
            Self::Networks => "Networks",
            Self::StoragePools => "Storage",
            Self::Snapshots => "Snapshots",
            Self::Events => "Events",
            Self::Node => "Node",
        }
    }

    pub fn all() -> &'static [ResourceView] {
        &[
            Self::VirtualMachines,
            Self::Networks,
            Self::StoragePools,
            Self::Snapshots,
            Self::Events,
            Self::Node,
        ]
    }

    pub fn next(&self) -> Self {
        match self {
            Self::VirtualMachines => Self::Networks,
            Self::Networks => Self::StoragePools,
            Self::StoragePools => Self::Snapshots,
            Self::Snapshots => Self::Events,
            Self::Events => Self::Node,
            Self::Node => Self::VirtualMachines,
        }
    }

    pub fn prev(&self) -> Self {
        match self {
            Self::VirtualMachines => Self::Node,
            Self::Networks => Self::VirtualMachines,
            Self::StoragePools => Self::Networks,
            Self::Snapshots => Self::StoragePools,
            Self::Events => Self::Snapshots,
            Self::Node => Self::Events,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ViewMode {
    Table,
    Details,
    Help,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InputMode {
    Normal,
    Search,
    Confirmation,
    Command,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SortColumn {
    Name,
    State,
    Cpu,
    Memory,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SortDirection {
    Ascending,
    Descending,
}

impl SortDirection {
    pub fn toggle(&self) -> Self {
        match self {
            Self::Ascending => Self::Descending,
            Self::Descending => Self::Ascending,
        }
    }
}

// ── App State ───────────────────────────────────────────────────────────

pub struct AppState {
    // Data
    pub vms: Vec<VmInfo>,
    pub networks: Vec<NetworkInfo>,
    pub storage_pools: Vec<StoragePoolInfo>,
    pub snapshots: Vec<SnapshotInfo>,
    pub node_info: Option<NodeInfo>,
    pub vm_details: Option<VmDetails>,
    pub vm_metrics: Vec<VmMetrics>,
    pub audit_events: Vec<AuditEvent>,

    // UI
    pub selected_index: usize,
    pub resource_view: ResourceView,
    pub view_mode: ViewMode,
    pub input_mode: InputMode,
    pub status_message: String,
    pub show_context_menu: bool,

    // Multi-select
    pub multi_select_mode: bool,
    pub selected_items: std::collections::HashSet<String>,

    // Search
    pub search_query: String,
    pub filtered_indices: Vec<usize>,

    // Sort
    pub sort_column: SortColumn,
    pub sort_direction: SortDirection,

    // Confirmation
    pub confirm_action: Option<String>,

    // Command
    pub command_input: String,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            vms: Vec::new(),
            networks: Vec::new(),
            storage_pools: Vec::new(),
            snapshots: Vec::new(),
            node_info: None,
            vm_details: None,
            vm_metrics: Vec::new(),
            audit_events: Vec::new(),

            selected_index: 0,
            resource_view: ResourceView::VirtualMachines,
            view_mode: ViewMode::Table,
            input_mode: InputMode::Normal,
            status_message: "Press '?' for help, ':' for commands".to_string(),
            show_context_menu: false,

            multi_select_mode: false,
            selected_items: std::collections::HashSet::new(),

            search_query: String::new(),
            filtered_indices: Vec::new(),

            sort_column: SortColumn::Name,
            sort_direction: SortDirection::Ascending,

            confirm_action: None,
            command_input: String::new(),
        }
    }

    pub fn add_audit_event(&mut self, action: &str, target: &str, result: &str) {
        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        self.audit_events.push(AuditEvent {
            timestamp: now,
            action: action.to_string(),
            target: target.to_string(),
            result: result.to_string(),
        });
        // Keep last 500 events
        if self.audit_events.len() > 500 {
            self.audit_events.remove(0);
        }
    }

    pub fn get_metrics_for_vm(&self, name: &str) -> Option<&VmMetrics> {
        self.vm_metrics.iter().find(|m| m.name == name)
    }

    pub fn toggle_selection(&mut self, name: &str) {
        if self.selected_items.contains(name) {
            self.selected_items.remove(name);
        } else {
            self.selected_items.insert(name.to_string());
        }
    }

    pub fn select_all_vms(&mut self) {
        for vm in &self.vms {
            self.selected_items.insert(vm.name.clone());
        }
    }

    pub fn clear_selection(&mut self) {
        self.selected_items.clear();
        self.multi_select_mode = false;
    }

    pub fn current_list_len(&self) -> usize {
        if !self.filtered_indices.is_empty() {
            return self.filtered_indices.len();
        }
        match self.resource_view {
            ResourceView::VirtualMachines => self.vms.len(),
            ResourceView::Networks => self.networks.len(),
            ResourceView::StoragePools => self.storage_pools.len(),
            ResourceView::Snapshots => self.snapshots.len(),
            ResourceView::Events => self.audit_events.len(),
            ResourceView::Node => 1,
        }
    }

    pub fn clamp_selection(&mut self) {
        let len = self.current_list_len();
        if len == 0 {
            self.selected_index = 0;
        } else if self.selected_index >= len {
            self.selected_index = len - 1;
        }
    }

    pub fn selected_vm_name(&self) -> Option<&str> {
        if self.resource_view != ResourceView::VirtualMachines {
            return None;
        }
        let idx = if !self.filtered_indices.is_empty() {
            *self.filtered_indices.get(self.selected_index)?
        } else {
            self.selected_index
        };
        self.vms.get(idx).map(|vm| vm.name.as_str())
    }

    pub fn selected_network_name(&self) -> Option<&str> {
        if self.resource_view != ResourceView::Networks {
            return None;
        }
        self.networks.get(self.selected_index).map(|n| n.name.as_str())
    }

    pub fn selected_pool_name(&self) -> Option<&str> {
        if self.resource_view != ResourceView::StoragePools {
            return None;
        }
        self.storage_pools.get(self.selected_index).map(|p| p.name.as_str())
    }

    pub fn selected_snapshot(&self) -> Option<&SnapshotInfo> {
        if self.resource_view != ResourceView::Snapshots {
            return None;
        }
        self.snapshots.get(self.selected_index)
    }

    pub fn apply_search_filter(&mut self) {
        if self.search_query.is_empty() {
            self.filtered_indices.clear();
            return;
        }
        let query = self.search_query.to_lowercase();
        self.filtered_indices = match self.resource_view {
            ResourceView::VirtualMachines => self
                .vms
                .iter()
                .enumerate()
                .filter(|(_, vm)| {
                    vm.name.to_lowercase().contains(&query)
                        || vm.state.to_lowercase().contains(&query)
                })
                .map(|(i, _)| i)
                .collect(),
            ResourceView::Networks => self
                .networks
                .iter()
                .enumerate()
                .filter(|(_, n)| n.name.to_lowercase().contains(&query))
                .map(|(i, _)| i)
                .collect(),
            ResourceView::StoragePools => self
                .storage_pools
                .iter()
                .enumerate()
                .filter(|(_, p)| p.name.to_lowercase().contains(&query))
                .map(|(i, _)| i)
                .collect(),
            ResourceView::Snapshots => self
                .snapshots
                .iter()
                .enumerate()
                .filter(|(_, s)| {
                    s.name.to_lowercase().contains(&query)
                        || s.vm_name.to_lowercase().contains(&query)
                })
                .map(|(i, _)| i)
                .collect(),
            ResourceView::Events => vec![],
            ResourceView::Node => vec![],
        };
        self.clamp_selection();
    }

    pub fn sort_vms(&mut self) {
        let dir = self.sort_direction;
        match self.sort_column {
            SortColumn::Name => self.vms.sort_by(|a, b| {
                let cmp = a.name.cmp(&b.name);
                if dir == SortDirection::Descending { cmp.reverse() } else { cmp }
            }),
            SortColumn::State => self.vms.sort_by(|a, b| {
                let cmp = a.state.cmp(&b.state);
                if dir == SortDirection::Descending { cmp.reverse() } else { cmp }
            }),
            SortColumn::Cpu => self.vms.sort_by(|a, b| {
                let cmp = a.vcpus.cmp(&b.vcpus);
                if dir == SortDirection::Descending { cmp.reverse() } else { cmp }
            }),
            SortColumn::Memory => self.vms.sort_by(|a, b| {
                let cmp = a.memory_mb.cmp(&b.memory_mb);
                if dir == SortDirection::Descending { cmp.reverse() } else { cmp }
            }),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
