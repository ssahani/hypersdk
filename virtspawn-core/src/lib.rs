pub mod audit;
pub mod config;
pub mod libvirt;
pub mod state;
pub mod validate;
pub mod xml;

pub use config::VirtspawnConfig;
pub use libvirt::LibvirtManager;
pub use state::{
    AppState, AttachDiskRequest, AuditEvent, CloneVmRequest, ConfirmationDialog,
    CreateNetworkRequest, CreateSnapshotRequest, CreateVmForm, CreateVmRequest,
    CreateVolumeRequest, DashboardStats, DiskInfo, Focus, FormField, FormFieldType,
    FIELD_DISK, FIELD_MEMORY, FIELD_NAME, FIELD_NETWORK, FIELD_TEMPLATE, FIELD_VCPUS,
    InputMode, InterfaceInfo, NetworkInfo, NodeInfo, NotifyLevel, ObjectTab, RenameVmRequest,
    ResourceView, SidebarCategory, SidebarItem, SnapshotInfo, SortColumn, SortDirection,
    StoragePoolInfo, StorageVolumeInfo, ViewMode, VmDetails, VmInfo, VmMetrics, VmTemplate,
};

#[derive(Debug, thiserror::Error)]
pub enum LibvirtError {
    #[error("Connection error: {0}")]
    Connection(String),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Operation failed: {0}")]
    Operation(String),
    #[error("Internal error: {0}")]
    Internal(String),
}
