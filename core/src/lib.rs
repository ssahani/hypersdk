pub mod audit;
pub mod build_precheck;
pub mod config;
pub mod fmt;
pub mod host_platform;
pub mod kubevirt;
pub mod libvirt;
pub mod state;
pub mod system_accounts;
pub mod validate;
pub mod xml;

pub use config::{
    AuthConfig, KubeVirtConfig, SshTerminalConfig, SshTerminalTarget, VirtspawnConfig, VmCreateBackend,
    DEFAULT_DAEMON_PORT,
};
pub use kubevirt::{kubevirt_bundle_from_libvirt_vm, KubeVirtBundle};
pub use libvirt::LibvirtManager;
pub use state::{
    AppState, AttachDiskRequest, AuditEvent, BackupInfo, BackupRequest, CloneVmRequest,
    ConfirmationDialog, CreateNetworkRequest, CreateSnapshotRequest, CreateVmRequest,
    CreateVolumeRequest, DashboardStats, DiskInfo, Focus, InputMode, InterfaceInfo, NetworkInfo,
    NodeInfo, NotifyLevel, ObjectTab, RenameVmRequest, ResourceView, RestoreRequest,
    SidebarCategory, SidebarItem, SnapshotInfo, SortColumn, SortDirection, StoragePoolInfo,
    StorageVolumeInfo, ViewMode, VmDetails, VmInfo, VmMetrics, VmTemplate,
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
    #[error("Forbidden: {0}")]
    Forbidden(String),
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
