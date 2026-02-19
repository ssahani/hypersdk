pub mod config;
pub mod libvirt;
pub mod state;

pub use config::VirtspawnConfig;
pub use libvirt::LibvirtManager;
pub use state::{
    AppState, CreateSnapshotRequest, DiskInfo, InterfaceInfo, NetworkInfo, NodeInfo,
    ResourceView, SnapshotInfo, StoragePoolInfo, StorageVolumeInfo, VmDetails, VmInfo,
    ViewMode, InputMode, SortColumn, SortDirection,
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
