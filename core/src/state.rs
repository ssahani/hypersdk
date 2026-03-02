use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::time::Instant;

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
    pub disk_rd_bytes: u64,
    pub disk_wr_bytes: u64,
    pub net_rx_bytes: u64,
    pub net_tx_bytes: u64,
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

// ── Create VM Request ───────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateVmRequest {
    pub name: String,
    #[serde(default = "default_vcpus")]
    pub vcpus: u32,
    #[serde(default = "default_memory")]
    pub memory_mb: u64,
    #[serde(default = "default_disk_gb")]
    pub disk_gb: u64,
    #[serde(default)]
    pub iso: String,
    #[serde(default = "default_network")]
    pub network: String,
    #[serde(default = "default_os_variant")]
    pub os_variant: String,
}

fn default_vcpus() -> u32 { 2 }
fn default_memory() -> u64 { 2048 }
fn default_disk_gb() -> u64 { 20 }
fn default_network() -> String { "default".to_string() }
fn default_os_variant() -> String { "linux2022".to_string() }

impl Default for CreateVmRequest {
    fn default() -> Self {
        Self {
            name: String::new(),
            vcpus: default_vcpus(),
            memory_mb: default_memory(),
            disk_gb: default_disk_gb(),
            iso: String::new(),
            network: default_network(),
            os_variant: default_os_variant(),
        }
    }
}

// ── Network Create Request ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateNetworkRequest {
    pub name: String,
    #[serde(default = "default_subnet")]
    pub subnet: String,
    #[serde(default = "default_dhcp_start")]
    pub dhcp_start: String,
    #[serde(default = "default_dhcp_end")]
    pub dhcp_end: String,
}

fn default_subnet() -> String { "192.168.100".to_string() }
fn default_dhcp_start() -> String { "192.168.100.100".to_string() }
fn default_dhcp_end() -> String { "192.168.100.254".to_string() }

// ── Volume Create Request ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateVolumeRequest {
    pub name: String,
    #[serde(default = "default_vol_capacity")]
    pub capacity_gb: u64,
    #[serde(default = "default_vol_format")]
    pub format: String,
}

fn default_vol_capacity() -> u64 { 10 }
fn default_vol_format() -> String { "qcow2".to_string() }

// ── Rename Request ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenameVmRequest {
    pub new_name: String,
}

// ── Dashboard Stats ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Default)]
pub struct DashboardStats {
    pub total_vms: usize,
    pub running_vms: usize,
    pub stopped_vms: usize,
    pub paused_vms: usize,
    pub total_vcpus: u32,
    pub total_memory_mb: u64,
    pub used_memory_mb: u64,
    pub total_networks: usize,
    pub active_networks: usize,
    pub total_pools: usize,
    pub active_pools: usize,
    pub total_snapshots: usize,
}

// ── Disk Attach Request ─────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttachDiskRequest {
    pub source: String,
    #[serde(default = "default_disk_target")]
    pub target: String,
    #[serde(default = "default_disk_driver")]
    pub driver: String,
}

fn default_disk_target() -> String { "vdb".to_string() }
fn default_disk_driver() -> String { "qcow2".to_string() }

// ── VM Templates ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VmTemplate {
    pub name: String,
    pub description: String,
    pub vcpus: u32,
    pub memory_mb: u64,
    pub disk_gb: u64,
    pub os_variant: String,
}

impl VmTemplate {
    pub fn all() -> Vec<VmTemplate> {
        vec![
            VmTemplate {
                name: "linux-small".to_string(),
                description: "Linux VM: 1 vCPU, 1 GB RAM, 10 GB disk".to_string(),
                vcpus: 1,
                memory_mb: 1024,
                disk_gb: 10,
                os_variant: "linux2022".to_string(),
            },
            VmTemplate {
                name: "linux-medium".to_string(),
                description: "Linux VM: 2 vCPUs, 4 GB RAM, 40 GB disk".to_string(),
                vcpus: 2,
                memory_mb: 4096,
                disk_gb: 40,
                os_variant: "linux2022".to_string(),
            },
            VmTemplate {
                name: "linux-large".to_string(),
                description: "Linux VM: 4 vCPUs, 8 GB RAM, 80 GB disk".to_string(),
                vcpus: 4,
                memory_mb: 8192,
                disk_gb: 80,
                os_variant: "linux2022".to_string(),
            },
            VmTemplate {
                name: "windows".to_string(),
                description: "Windows VM: 4 vCPUs, 8 GB RAM, 60 GB disk".to_string(),
                vcpus: 4,
                memory_mb: 8192,
                disk_gb: 60,
                os_variant: "win11".to_string(),
            },
            VmTemplate {
                name: "minimal".to_string(),
                description: "Minimal: 1 vCPU, 512 MB RAM, 5 GB disk".to_string(),
                vcpus: 1,
                memory_mb: 512,
                disk_gb: 5,
                os_variant: "linux2022".to_string(),
            },
        ]
    }

    pub fn find(name: &str) -> Option<VmTemplate> {
        Self::all().into_iter().find(|t| t.name == name)
    }
}

// ── Notification Level ───────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NotifyLevel {
    Success,
    Error,
    Warning,
    Info,
}

// ── Confirmation Dialog ─────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct ConfirmationDialog {
    pub title: String,
    pub message: String,
    pub resource_name: String,
    pub action: String,
}

// ── Create VM Form ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FormFieldType {
    Text,
    Number,
    TemplateSelect,
}

#[derive(Debug, Clone)]
pub struct FormField {
    pub label: String,
    pub value: String,
    pub field_type: FormFieldType,
    pub validation_error: Option<String>,
}

// Named field indices to avoid magic numbers
pub const FIELD_NAME: usize = 0;
pub const FIELD_TEMPLATE: usize = 1;
pub const FIELD_VCPUS: usize = 2;
pub const FIELD_MEMORY: usize = 3;
pub const FIELD_DISK: usize = 4;
pub const FIELD_NETWORK: usize = 5;

#[derive(Debug, Clone)]
pub struct CreateVmForm {
    pub fields: Vec<FormField>,
    pub focused_field: usize,
    pub template_index: usize,
}

impl CreateVmForm {
    pub fn new() -> Self {
        Self {
            fields: vec![
                FormField {
                    label: "Name".to_string(),
                    value: String::new(),
                    field_type: FormFieldType::Text,
                    validation_error: None,
                },
                FormField {
                    label: "Template".to_string(),
                    value: "(none)".to_string(),
                    field_type: FormFieldType::TemplateSelect,
                    validation_error: None,
                },
                FormField {
                    label: "vCPUs".to_string(),
                    value: "2".to_string(),
                    field_type: FormFieldType::Number,
                    validation_error: None,
                },
                FormField {
                    label: "Memory (MB)".to_string(),
                    value: "2048".to_string(),
                    field_type: FormFieldType::Number,
                    validation_error: None,
                },
                FormField {
                    label: "Disk (GB)".to_string(),
                    value: "20".to_string(),
                    field_type: FormFieldType::Number,
                    validation_error: None,
                },
                FormField {
                    label: "Network".to_string(),
                    value: "default".to_string(),
                    field_type: FormFieldType::Text,
                    validation_error: None,
                },
            ],
            focused_field: 0,
            template_index: 0, // 0 = "(none)"
        }
    }

    pub fn apply_template(&mut self, tmpl: &VmTemplate) {
        self.fields[FIELD_VCPUS].value = tmpl.vcpus.to_string();
        self.fields[FIELD_MEMORY].value = tmpl.memory_mb.to_string();
        self.fields[FIELD_DISK].value = tmpl.disk_gb.to_string();
    }

    fn validate_field<T: std::str::FromStr + Copy>(
        field: &mut FormField,
        valid: &mut bool,
        check: impl FnOnce(T) -> bool,
        err_msg: &str,
    ) {
        match field.value.parse::<T>() {
            Ok(v) if check(v) => field.validation_error = None,
            _ => {
                field.validation_error = Some(err_msg.to_string());
                *valid = false;
            }
        }
    }

    pub fn validate(&mut self) -> bool {
        let mut valid = true;

        // Validate name
        let name = &self.fields[FIELD_NAME].value;
        let name_err = if name.is_empty() {
            Some("Name required")
        } else if name.len() > 64 {
            Some("Max 64 chars")
        } else if !name.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == '.') {
            Some("Invalid chars")
        } else if name.starts_with('-') || name.starts_with('.') {
            Some("Bad start char")
        } else {
            None
        };
        if let Some(err) = name_err {
            self.fields[FIELD_NAME].validation_error = Some(err.to_string());
            valid = false;
        } else {
            self.fields[FIELD_NAME].validation_error = None;
        }

        Self::validate_field::<u32>(&mut self.fields[FIELD_VCPUS], &mut valid,
            |v| (1..=256).contains(&v), "1-256");
        Self::validate_field::<u64>(&mut self.fields[FIELD_MEMORY], &mut valid,
            |v| (64..=1_048_576).contains(&v), "64-1048576 MB");
        Self::validate_field::<u64>(&mut self.fields[FIELD_DISK], &mut valid,
            |v| (1..=10_240).contains(&v), "1-10240 GB");

        if self.fields[FIELD_NETWORK].value.is_empty() {
            self.fields[FIELD_NETWORK].validation_error = Some("Required".to_string());
            valid = false;
        } else {
            self.fields[FIELD_NETWORK].validation_error = None;
        }

        valid
    }

    pub fn to_create_request(&self) -> CreateVmRequest {
        CreateVmRequest {
            name: self.fields[FIELD_NAME].value.clone(),
            vcpus: self.fields[FIELD_VCPUS].value.parse().unwrap_or(2),
            memory_mb: self.fields[FIELD_MEMORY].value.parse().unwrap_or(2048),
            disk_gb: self.fields[FIELD_DISK].value.parse().unwrap_or(20),
            network: self.fields[FIELD_NETWORK].value.clone(),
            ..Default::default()
        }
    }
}

impl Default for CreateVmForm {
    fn default() -> Self {
        Self::new()
    }
}

// ── Sidebar / Content Focus Model ───────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Focus {
    #[default]
    Sidebar,
    Content,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ObjectTab {
    #[default]
    Summary,
    Monitor,
    Configure,
}

impl ObjectTab {
    pub fn label(&self) -> &'static str {
        match self {
            Self::Summary => "Summary",
            Self::Monitor => "Monitor",
            Self::Configure => "Configure",
        }
    }

    pub fn all() -> &'static [ObjectTab] {
        &[Self::Summary, Self::Monitor, Self::Configure]
    }

    pub fn next(&self) -> Self {
        match self {
            Self::Summary => Self::Monitor,
            Self::Monitor => Self::Configure,
            Self::Configure => Self::Summary,
        }
    }

    pub fn prev(&self) -> Self {
        match self {
            Self::Summary => Self::Configure,
            Self::Monitor => Self::Summary,
            Self::Configure => Self::Monitor,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SidebarCategory {
    VirtualMachines,
    Networks,
    Storage,
    Snapshots,
}

impl SidebarCategory {
    pub fn all() -> &'static [SidebarCategory] {
        &[
            Self::VirtualMachines,
            Self::Networks,
            Self::Storage,
            Self::Snapshots,
        ]
    }

    pub fn label(&self) -> &'static str {
        match self {
            Self::VirtualMachines => "VMs",
            Self::Networks => "Networks",
            Self::Storage => "Storage",
            Self::Snapshots => "Snapshots",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SidebarItem {
    Category(SidebarCategory),
    Vm(String),
    Network(String),
    StoragePool(String),
    Snapshot(String, String), // (vm_name, snap_name)
}

// ── TUI State ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ResourceView {
    #[default]
    VirtualMachines,
    Networks,
    StoragePools,
    Snapshots,
    Events,
    Node,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ViewMode {
    #[default]
    Table,
    Xml,
    Logs,
    Help,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum InputMode {
    #[default]
    Normal,
    Search,
    Confirmation,
    Command,
    CreateVmDialog,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum SortColumn {
    #[default]
    Name,
    State,
    Cpu,
    Memory,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum SortDirection {
    #[default]
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

    pub fn apply(&self, cmp: std::cmp::Ordering) -> std::cmp::Ordering {
        match self {
            Self::Ascending => cmp,
            Self::Descending => cmp.reverse(),
        }
    }
}

// ── Bounded buffer helper ───────────────────────────────────────────────

fn push_bounded<T>(buf: &mut VecDeque<T>, item: T, max: usize) {
    buf.push_back(item);
    if buf.len() > max {
        buf.pop_front();
    }
}

// ── App State ───────────────────────────────────────────────────────────

#[derive(Default)]
pub struct AppState {
    // Data
    pub vms: Vec<VmInfo>,
    pub networks: Vec<NetworkInfo>,
    pub storage_pools: Vec<StoragePoolInfo>,
    pub snapshots: Vec<SnapshotInfo>,
    pub node_info: Option<NodeInfo>,
    pub vm_details: Option<VmDetails>,
    pub vm_metrics: Vec<VmMetrics>,
    pub audit_events: VecDeque<AuditEvent>,
    pub xml_content: String,
    pub scroll_offset: u16,
    pub dashboard: DashboardStats,
    pub volumes: Vec<StorageVolumeInfo>,
    pub browsing_pool: Option<String>,
    pub log_content: String,
    pub notification: Option<(String, Instant, NotifyLevel)>,
    pub notification_history: VecDeque<(String, NotifyLevel, String)>,

    // UI
    pub selected_index: usize,
    pub resource_view: ResourceView,
    pub view_mode: ViewMode,
    pub input_mode: InputMode,
    pub status_message: String,
    pub show_context_menu: bool,
    pub connected: bool,

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
    pub confirm_dialog: Option<ConfirmationDialog>,

    // Command
    pub command_input: String,

    // VM state transitions
    pub previous_vm_states: HashMap<String, String>,
    pub state_changed_vms: HashMap<String, Instant>,

    // Metrics history (sparklines)
    pub metrics_history: HashMap<String, VecDeque<f64>>,

    // Create VM form
    pub create_vm_form: Option<CreateVmForm>,

    // Sidebar + Content focus model
    pub focus: Focus,
    pub active_object_tab: ObjectTab,
    pub sidebar_selected: usize,
    pub sidebar_collapsed: HashMap<SidebarCategory, bool>,
    pub sidebar_items: Vec<SidebarItem>,
    pub content_scroll_offset: u16,
    pub command_content_override: Option<ResourceView>,
    pub help_scroll: u16,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            status_message: "Press '?' for help, ':' for commands".to_string(),
            ..Default::default()
        }
    }

    pub fn rebuild_sidebar(&mut self) {
        self.sidebar_items.clear();

        // Data-driven: each category maps to its child items
        let categories: Vec<(SidebarCategory, Vec<SidebarItem>)> = vec![
            (SidebarCategory::VirtualMachines,
             self.vms.iter().map(|vm| SidebarItem::Vm(vm.name.clone())).collect()),
            (SidebarCategory::Networks,
             self.networks.iter().map(|n| SidebarItem::Network(n.name.clone())).collect()),
            (SidebarCategory::Storage,
             self.storage_pools.iter().map(|p| SidebarItem::StoragePool(p.name.clone())).collect()),
            (SidebarCategory::Snapshots,
             self.snapshots.iter().map(|s| SidebarItem::Snapshot(s.vm_name.clone(), s.name.clone())).collect()),
        ];

        for (cat, children) in categories {
            self.sidebar_items.push(SidebarItem::Category(cat));
            if !self.is_collapsed(cat) {
                self.sidebar_items.extend(children);
            }
        }

        // Clamp sidebar selection
        if !self.sidebar_items.is_empty() && self.sidebar_selected >= self.sidebar_items.len() {
            self.sidebar_selected = self.sidebar_items.len() - 1;
        }
    }

    fn is_collapsed(&self, cat: SidebarCategory) -> bool {
        *self.sidebar_collapsed.get(&cat).unwrap_or(&false)
    }

    pub fn toggle_sidebar_collapse(&mut self) {
        if let Some(SidebarItem::Category(cat)) = self.sidebar_items.get(self.sidebar_selected).cloned() {
            let collapsed = self.is_collapsed(cat);
            self.sidebar_collapsed.insert(cat, !collapsed);
            self.rebuild_sidebar();
        }
    }

    pub fn selected_sidebar_item(&self) -> Option<&SidebarItem> {
        self.sidebar_items.get(self.sidebar_selected)
    }

    pub fn sidebar_resource_view(&self) -> ResourceView {
        match self.selected_sidebar_item() {
            Some(SidebarItem::Category(SidebarCategory::VirtualMachines)) | Some(SidebarItem::Vm(_)) => ResourceView::VirtualMachines,
            Some(SidebarItem::Category(SidebarCategory::Networks)) | Some(SidebarItem::Network(_)) => ResourceView::Networks,
            Some(SidebarItem::Category(SidebarCategory::Storage)) | Some(SidebarItem::StoragePool(_)) => ResourceView::StoragePools,
            Some(SidebarItem::Category(SidebarCategory::Snapshots)) | Some(SidebarItem::Snapshot(_, _)) => ResourceView::Snapshots,
            None => ResourceView::VirtualMachines,
        }
    }

    pub fn sidebar_selected_name(&self) -> Option<&str> {
        match self.selected_sidebar_item() {
            Some(SidebarItem::Vm(name)) => Some(name.as_str()),
            Some(SidebarItem::Network(name)) => Some(name.as_str()),
            Some(SidebarItem::StoragePool(name)) => Some(name.as_str()),
            Some(SidebarItem::Snapshot(_, name)) => Some(name.as_str()),
            _ => None,
        }
    }

    pub fn effective_vm_name(&self) -> Option<&str> {
        match self.selected_sidebar_item() {
            Some(SidebarItem::Vm(name)) => Some(name.as_str()),
            Some(SidebarItem::Category(SidebarCategory::VirtualMachines)) => self.selected_vm_name(),
            _ => None,
        }
    }

    pub fn effective_network_name(&self) -> Option<&str> {
        match self.selected_sidebar_item() {
            Some(SidebarItem::Network(name)) => Some(name.as_str()),
            Some(SidebarItem::Category(SidebarCategory::Networks)) => self.selected_network_name(),
            _ => None,
        }
    }

    pub fn effective_pool_name(&self) -> Option<&str> {
        match self.selected_sidebar_item() {
            Some(SidebarItem::StoragePool(name)) => Some(name.as_str()),
            Some(SidebarItem::Category(SidebarCategory::Storage)) => self.selected_pool_name(),
            _ => None,
        }
    }

    pub fn effective_snapshot(&self) -> Option<&SnapshotInfo> {
        match self.selected_sidebar_item() {
            Some(SidebarItem::Snapshot(vm, snap)) => self.find_snapshot(vm, snap),
            Some(SidebarItem::Category(SidebarCategory::Snapshots)) => self.selected_snapshot(),
            _ => None,
        }
    }

    pub fn add_audit_event(&mut self, action: &str, target: &str, result: &str) {
        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let event = AuditEvent {
            timestamp: now,
            action: action.to_string(),
            target: target.to_string(),
            result: result.to_string(),
        };
        crate::audit::write_audit_event(&event);
        push_bounded(&mut self.audit_events, event, 500);
    }

    pub fn compute_dashboard(&mut self) {
        let running_vms = self.vms.iter().filter(|v| v.state == "running").count();
        let paused_vms = self.vms.iter().filter(|v| v.state == "paused").count();
        let stopped_vms = self.vms.len() - running_vms - paused_vms;
        let total_vcpus: u32 = self.vms.iter().map(|v| v.vcpus).sum();
        let total_memory_mb: u64 = self.vms.iter().map(|v| v.memory_mb).sum();
        let used_memory_mb: u64 = self.vm_metrics.iter().map(|m| m.memory_used_mb).sum();

        self.dashboard = DashboardStats {
            total_vms: self.vms.len(),
            running_vms,
            stopped_vms,
            paused_vms,
            total_vcpus,
            total_memory_mb,
            used_memory_mb,
            total_networks: self.networks.len(),
            active_networks: self.networks.iter().filter(|n| n.active).count(),
            total_pools: self.storage_pools.len(),
            active_pools: self.storage_pools.iter().filter(|p| p.state == "running").count(),
            total_snapshots: self.snapshots.len(),
        };
    }

    pub fn notify(&mut self, msg: &str) {
        let level = if msg.contains("Error") || msg.contains("ERROR") || msg.contains("failed") {
            NotifyLevel::Error
        } else if msg.contains("warn") || msg.contains("WARN") {
            NotifyLevel::Warning
        } else {
            NotifyLevel::Success
        };
        self.notify_with_level(msg, level);
    }

    pub fn notify_with_level(&mut self, msg: &str, level: NotifyLevel) {
        self.notification = Some((msg.to_string(), Instant::now(), level));
        let timestamp = chrono::Local::now().format("%H:%M:%S").to_string();
        push_bounded(&mut self.notification_history, (msg.to_string(), level, timestamp), 100);
    }

    pub fn load_audit_history(&mut self) {
        self.audit_events = crate::audit::load_audit_events(500).into();
    }

    pub fn find_vm(&self, name: &str) -> Option<&VmInfo> {
        self.vms.iter().find(|v| v.name == name)
    }

    pub fn vm_state_str(&self, name: &str) -> &str {
        self.find_vm(name).map(|v| v.state.as_str()).unwrap_or("unknown")
    }

    pub fn find_network(&self, name: &str) -> Option<&NetworkInfo> {
        self.networks.iter().find(|n| n.name == name)
    }

    pub fn find_pool(&self, name: &str) -> Option<&StoragePoolInfo> {
        self.storage_pools.iter().find(|p| p.name == name)
    }

    pub fn find_snapshot(&self, vm_name: &str, snap_name: &str) -> Option<&SnapshotInfo> {
        self.snapshots.iter().find(|s| s.vm_name == vm_name && s.name == snap_name)
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

        let mut scored = match self.resource_view {
            ResourceView::VirtualMachines => score_searchable(&self.vms, &query),
            ResourceView::Networks => score_searchable(&self.networks, &query),
            ResourceView::StoragePools => score_searchable(&self.storage_pools, &query),
            ResourceView::Snapshots => score_searchable(&self.snapshots, &query),
            ResourceView::Events | ResourceView::Node => vec![],
        };

        scored.sort_by(|a, b| b.1.cmp(&a.1));
        self.filtered_indices = scored.into_iter().map(|(i, _)| i).collect();
        self.clamp_selection();
    }

    pub fn detect_state_changes(&mut self) {
        self.state_changed_vms.retain(|_, when| when.elapsed().as_secs() < 3);

        for vm in &self.vms {
            if let Some(prev_state) = self.previous_vm_states.get(&vm.name) {
                if *prev_state != vm.state {
                    self.state_changed_vms.insert(vm.name.clone(), Instant::now());
                }
            }
        }

        self.previous_vm_states.clear();
        for vm in &self.vms {
            self.previous_vm_states.insert(vm.name.clone(), vm.state.clone());
        }
    }

    pub fn record_metrics_snapshot(&mut self) {
        for m in &self.vm_metrics {
            let history = self.metrics_history.entry(m.name.clone()).or_default();
            push_bounded(history, m.memory_pct, 20);
        }
    }

    pub fn sort_vms(&mut self) {
        let dir = self.sort_direction;
        match self.sort_column {
            SortColumn::Name => self.vms.sort_by(|a, b| dir.apply(a.name.cmp(&b.name))),
            SortColumn::State => self.vms.sort_by(|a, b| dir.apply(a.state.cmp(&b.state))),
            SortColumn::Cpu => self.vms.sort_by(|a, b| dir.apply(a.vcpus.cmp(&b.vcpus))),
            SortColumn::Memory => self.vms.sort_by(|a, b| dir.apply(a.memory_mb.cmp(&b.memory_mb))),
        }
    }
}


// ── Searchable trait ────────────────────────────────────────────────────

trait Searchable {
    fn search_fields(&self) -> Vec<String>;
}

impl Searchable for VmInfo {
    fn search_fields(&self) -> Vec<String> {
        vec![self.name.to_lowercase(), self.state.to_lowercase()]
    }
}

impl Searchable for NetworkInfo {
    fn search_fields(&self) -> Vec<String> {
        vec![self.name.to_lowercase()]
    }
}

impl Searchable for StoragePoolInfo {
    fn search_fields(&self) -> Vec<String> {
        vec![self.name.to_lowercase()]
    }
}

impl Searchable for SnapshotInfo {
    fn search_fields(&self) -> Vec<String> {
        vec![self.name.to_lowercase(), self.vm_name.to_lowercase()]
    }
}

fn score_searchable<T: Searchable>(items: &[T], query: &str) -> Vec<(usize, i32)> {
    items.iter().enumerate()
        .filter_map(|(i, item)| {
            let best = item.search_fields().iter()
                .map(|f| fuzzy_match(f, query))
                .max()
                .unwrap_or(0);
            if best > 0 { Some((i, best)) } else { None }
        })
        .collect()
}

/// Fuzzy match: all query characters must appear in order in the target.
/// Returns a score > 0 on match, 0 on no match.
/// Consecutive matches and prefix matches score higher.
pub fn fuzzy_match(target: &str, query: &str) -> i32 {
    let target_chars: Vec<char> = target.chars().collect();
    let query_chars: Vec<char> = query.chars().collect();

    if query_chars.is_empty() {
        return 1;
    }
    if query_chars.len() > target_chars.len() {
        return 0;
    }

    // Exact substring match gets highest score
    if target.contains(query) {
        return 100 + (query_chars.len() as i32 * 10);
    }

    let mut score = 0i32;
    let mut ti = 0;
    let mut prev_match = false;
    let mut consecutive = 0;

    for &qc in &query_chars {
        let mut found = false;
        while ti < target_chars.len() {
            if target_chars[ti] == qc {
                found = true;
                score += 1;
                if ti == 0 {
                    score += 5; // prefix bonus
                }
                if prev_match {
                    consecutive += 1;
                    score += consecutive * 2; // consecutive bonus
                } else {
                    consecutive = 0;
                }
                prev_match = true;
                ti += 1;
                break;
            }
            prev_match = false;
            ti += 1;
        }
        if !found {
            return 0; // query char not found
        }
    }

    score
}
