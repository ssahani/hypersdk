// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

//! OpenStack: Nova instance management and native Glance image upload.

mod auth;
mod catalogs_ext;
mod clouds;
mod compute;
mod console_tunnel;
mod glance;
mod glance_meta;
mod instance_ops;
mod keypairs_ops;
mod lifecycle;
mod libvirt_push;
mod networking;
mod pull;
mod quotas;
mod resources;
mod security_groups;
mod topology;
mod volumes;

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
    GlancePullRequest, GlancePullResult, GlanceUploadPreview, GlanceUploadRequest,
    GlanceUploadResult,
};
pub use libvirt_push::{
    is_supported_upload_disk, libvirt_openstack_push_preview, libvirt_root_disk_path,
    LibvirtOpenStackPushPreview,
};
pub use pull::pull_glance_image_to_disk;
pub use instance_ops::{
    add_security_group, attach_volume, detach_volume, export_instance_plan, export_instance_to_disk,
    get_console_output,
    get_remote_console, pause_instance, rebuild_instance, remove_security_group, resize_instance,
    resume_instance, suspend_instance, unpause_instance, update_instance_metadata,
    AttachVolumeRequest, OpenStackConsoleOutput, OpenStackExportPlan, OpenStackRemoteConsole,
    RebuildInstanceRequest, UpdateMetadataRequest,
};
pub use security_groups::{
    get_security_group, list_security_groups, OpenStackSecurityGroup, OpenStackSecurityGroupRule,
};
pub use volumes::{
    create_cinder_volume, delete_cinder_volume, extend_cinder_volume, snapshot_cinder_volume,
    ExtendVolumeRequest, OpenStackCreateVolumeRequest, SnapshotVolumeRequest,
};
pub use keypairs_ops::{create_keypair, delete_keypair, CreateKeypairRequest};
pub use lifecycle::{
    attach_interface, backup_instance, detach_interface, instance_stack_hint,
    list_instance_interfaces, migrate_instance, rescue_instance, shelve_instance,
    unrescue_instance, unshelve_instance, AttachInterfaceRequest, BackupInstanceRequest,
    MigrateInstanceRequest, OpenStackInstanceInterface, RescueInstanceRequest,
};
pub use topology::{
    list_ports, list_routers, list_subnets, OpenStackPort, OpenStackRouter, OpenStackSubnet,
};
pub use quotas::{get_quota_summary, OpenStackQuotaSummary};
pub use catalogs_ext::{
    list_server_groups, list_volume_types, OpenStackServerGroup, OpenStackVolumeType,
};
pub use glance_meta::{
    add_image_member, delete_image_member, list_image_members, update_image_metadata,
    AddImageMemberRequest, OpenStackImageMember, UpdateImageMetadataRequest,
};
pub use clouds::{list_configured_clouds, OpenStackCloudEntry};
pub use console_tunnel::{issue_console_token, remote_console_with_tunnel, resolve_console_token};
pub use security_groups::{
    create_security_group, create_security_group_rule, delete_security_group,
    delete_security_group_rule, CreateSecurityGroupRequest, CreateSecurityGroupRuleRequest,
};
pub use networking::{
    associate_floating_ip, dissociate_floating_ip, list_floating_ips, list_instance_floating_ips,
    AssociateFloatingIpRequest, OpenStackFloatingIp,
};
pub use resources::{
    create_instance, enrich_instance_flavor, list_flavors, list_images, list_instance_volumes,
    list_cinder_volumes, list_keypairs, list_networks, snapshot_instance, wait_glance_image_by_name,
    CreateInstanceRequest,
    CreateInstanceResponse,
    OpenStackAttachedVolume, OpenStackFlavor, OpenStackImage, OpenStackKeyPair, OpenStackNetwork,
};
