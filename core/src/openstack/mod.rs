//! OpenStack: Nova instance management and native Glance image upload.

mod auth;
mod compute;
mod glance;
mod instance_ops;
mod networking;
mod resources;

pub use auth::{
    connect_session, default_cloud_from_yaml, effective_cloud_name_for_config,
    resolve_clouds_yaml_path,
};
pub use compute::{
    connect_cloud, connection_status_skeleton, delete_instance, get_instance,
    is_openstack_configured, list_instances, reboot_instance, start_instance, stop_instance,
    test_connection, OpenStackConnectionStatus, OpenStackInstance,
};
pub use glance::{
    delete_glance_image, preview_qcow2_upload, upload_cloud_hint, upload_qcow2_to_glance,
    GlanceUploadPreview, GlanceUploadRequest, GlanceUploadResult,
};
pub use instance_ops::{
    add_security_group, attach_volume, detach_volume, export_instance_plan, get_console_output,
    get_remote_console, pause_instance, remove_security_group, resize_instance, resume_instance,
    suspend_instance, unpause_instance, AttachVolumeRequest, OpenStackConsoleOutput,
    OpenStackExportPlan, OpenStackRemoteConsole,
};
pub use networking::{
    associate_floating_ip, dissociate_floating_ip, list_floating_ips, list_instance_floating_ips,
    AssociateFloatingIpRequest, OpenStackFloatingIp,
};
pub use resources::{
    create_instance, enrich_instance_flavor, list_flavors, list_images, list_instance_volumes,
    list_cinder_volumes, list_keypairs, list_networks, snapshot_instance, CreateInstanceRequest,
    CreateInstanceResponse,
    OpenStackAttachedVolume, OpenStackFlavor, OpenStackImage, OpenStackKeyPair, OpenStackNetwork,
};
