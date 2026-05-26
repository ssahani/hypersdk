pub mod api_error;
pub mod audit;
pub mod audit_ship;
pub mod bpf_probe;
pub mod linux_audit;
pub mod observability_settings;
pub mod trace_context;
pub mod otlp;
pub mod run_as_user;
pub mod build_precheck;
pub mod config;
pub mod fmt;
pub mod host_inventory;
pub mod metrics_history;
pub mod host_linux_obs;
pub mod host_platform;
pub mod host_virt;
pub mod ldap_role;
pub mod obs_counters;
pub mod kubevirt;
pub mod openstack;
pub mod libvirt;
pub mod state;
pub mod system_accounts;
pub mod validate;
pub mod xml;

pub use api_error::{format_http_error_body, format_user_error, friendly_error_code, sanitize_error_text};
pub use trace_context::{format_traceparent, trace_context_from_headers, HttpTraceContext};
pub use observability_settings::{
    apply_observability_patch, settings_view_from_config, AuditObservabilityView,
    MetricsHistoryRemoteView, ObservabilitySettingsPatch, ObservabilitySettingsView,
    OtlpSettingsView,
};
pub use config::{
    AuthConfig, FleetConfig, FleetPeer, HypersdkConfig, KubeVirtConfig, LdapConfig, MachinaConfig,
    OpenStackConfig, OidcConfig, OidcDefaultRole, RunAsUserConfig, SshTerminalConfig,
    SshTerminalTarget, VmCreateBackend, DEFAULT_DAEMON_PORT,
};
pub use kubevirt::{
    kubevirt_bundle_from_libvirt_vm, kubevirt_bundle_from_qcow2, resolve_guest_os, GuestOsFamily,
    KubeVirtBundle,
};
pub use openstack::{
    add_security_group, associate_floating_ip, attach_volume, connection_status_skeleton,
    create_instance, default_cloud_from_yaml, delete_glance_image, delete_instance, detach_volume,
    dissociate_floating_ip, effective_cloud_name_for_config, enrich_instance_flavor,
    export_instance_plan, export_instance_to_disk, get_console_output, get_instance,
    get_remote_console,
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
    OpenStackCreateStep, OpenStackCreateWizard, SidebarCategory, SidebarItem, SnapshotInfo,
    SortColumn, SortDirection, StoragePoolInfo, StorageVolumeInfo, ViewMode, VmDetails, VmInfo,
    VmBlockDeviceMetrics, VmMetrics, VmNetDeviceMetrics, VmTemplate,
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
