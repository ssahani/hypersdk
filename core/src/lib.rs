pub mod audit;
pub mod config;
pub mod fmt;
pub mod libvirt;
pub mod state;
pub mod validate;
pub mod xml;

pub use config::{AuthConfig, VirtspawnConfig, DEFAULT_DAEMON_PORT};
pub use libvirt::LibvirtManager;
pub use state::{
    AppState, AttachDiskRequest, AuditEvent, BackupInfo, BackupRequest, CloneVmRequest,
    ConfirmationDialog, CreateNetworkRequest, CreateSnapshotRequest, CreateVmForm,
    CreateVmRequest, CreateVolumeRequest, DashboardStats, DiskInfo, Focus, FormField,
    FormFieldType, FIELD_DISK, FIELD_MEMORY, FIELD_NAME, FIELD_NETWORK, FIELD_TEMPLATE,
    FIELD_VCPUS, InputMode, InterfaceInfo, NetworkInfo, NodeInfo, NotifyLevel, ObjectTab,
    RenameVmRequest, ResourceView, RestoreRequest, SidebarCategory, SidebarItem, SnapshotInfo,
    SortColumn, SortDirection, StoragePoolInfo, StorageVolumeInfo, ViewMode, VmDetails, VmInfo,
    VmMetrics, VmTemplate,
};

pub const UNKNOWN: &str = "unknown";

pub fn unknown_string() -> String {
    UNKNOWN.to_string()
}

#[derive(Debug, thiserror::Error)]
pub enum LibvirtError {
    #[error("Connection error: {0}")]
    Connection(String),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Invalid input: {0}")]
    Invalid(String),
    #[error("Operation failed: {0}")]
    Operation(String),
    #[error("Internal error: {0}")]
    Internal(String),
}

impl LibvirtError {
    pub fn map_op<E: std::fmt::Display>(msg: &str) -> impl FnOnce(E) -> Self + '_ {
        move |e| Self::Operation(format!("{msg}: {e}"))
    }
}
