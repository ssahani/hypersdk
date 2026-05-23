pub mod audit;
pub mod build_precheck;
pub mod config;
pub mod fmt;
pub mod host_inventory;
pub mod host_platform;
pub mod host_virt;
pub mod kubevirt;
pub mod openstack;
pub mod libvirt;
pub mod state;
pub mod system_accounts;
pub mod validate;
pub mod xml;

pub use config::{
    AuthConfig, KubeVirtConfig, MachinaConfig, OpenStackConfig, OidcConfig, OidcDefaultRole,
    SshTerminalConfig, SshTerminalTarget, VmCreateBackend, DEFAULT_DAEMON_PORT,
};
pub use kubevirt::{
    kubevirt_bundle_from_libvirt_vm, kubevirt_bundle_from_qcow2, resolve_guest_os, GuestOsFamily,
    KubeVirtBundle,
};
pub use openstack::{
    add_security_group, associate_floating_ip, attach_volume, connection_status_skeleton,
    create_instance, default_cloud_from_yaml, delete_glance_image, delete_instance, detach_volume,
    dissociate_floating_ip, effective_cloud_name_for_config, enrich_instance_flavor,
    export_instance_plan, get_console_output, get_instance, get_remote_console,
    is_openstack_configured, list_flavors, list_floating_ips, list_images,
    list_cinder_volumes, list_instance_floating_ips, list_instance_volumes, list_instances,
    list_keypairs, list_networks,
    libvirt_openstack_push_preview, libvirt_root_disk_path, pause_instance, preview_qcow2_upload,
    pull_glance_image_to_disk, reboot_instance, remove_security_group, resize_instance,
    resolve_clouds_yaml_path, resume_instance, snapshot_instance, start_instance, stop_instance,
    suspend_instance, test_connection, unpause_instance, upload_qcow2_to_glance,
    AssociateFloatingIpRequest, AttachVolumeRequest, CreateInstanceRequest, CreateInstanceResponse,
    GlancePullRequest, GlancePullResult, GlanceUploadPreview, GlanceUploadRequest, GlanceUploadResult,
    LibvirtOpenStackPushPreview, OpenStackAttachedVolume,
    OpenStackConnectionStatus, OpenStackConsoleOutput, OpenStackExportPlan, OpenStackFlavor,
    OpenStackFloatingIp, OpenStackImage, OpenStackInstance, OpenStackKeyPair, OpenStackNetwork,
    OpenStackRemoteConsole,
};
pub use libvirt::{LibvirtManager, LibvirtTarget};
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
