pub mod config;
pub mod libvirt;
pub mod state;

pub use config::VirtspawnConfig;
pub use libvirt::LibvirtManager;
pub use state::{
    AppState, AuditEvent, CloneVmRequest, CreateSnapshotRequest, CreateVmRequest, DiskInfo,
    InputMode, InterfaceInfo, NetworkInfo, NodeInfo, ResourceView, SnapshotInfo, SortColumn,
    SortDirection, StoragePoolInfo, StorageVolumeInfo, ViewMode, VmDetails, VmInfo, VmMetrics,
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
