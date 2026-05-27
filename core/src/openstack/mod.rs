// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

//! OpenStack: Nova instance management and native Glance image upload.

mod admin;
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

pub use admin::{
    add_aggregate_host, create_host_aggregate, list_availability_zones, list_compute_services,
    list_host_aggregates, list_hypervisors, get_hypervisor, list_neutron_agents,
    remove_aggregate_host, set_compute_service_state, set_hypervisor_maintenance,
    set_neutron_agent_admin, update_host_aggregate, CreateAggregateRequest,
    OpenStackAvailabilityZone, OpenStackComputeService, OpenStackHostAggregate,
    OpenStackHypervisor, OpenStackNeutronAgent, SetComputeServiceRequest, UpdateAggregateRequest,
};
pub use auth::{
    connect_session, default_cloud_from_yaml, effective_cloud_name_for_config,
    resolve_clouds_yaml_path,
};
pub use compute::{
    connect_cloud, connection_status_skeleton, delete_instance, force_delete_instance, get_instance,
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
    confirm_resize_instance, get_remote_console, lock_instance, pause_instance, rebuild_instance,
    remove_security_group, rename_instance, reset_instance_state, resize_instance,
    revert_resize_instance, resume_instance, unlock_instance, RenameInstanceRequest, ResizeInstanceRequest,
    suspend_instance, unpause_instance, update_instance_metadata,
    AttachVolumeRequest, OpenStackConsoleOutput, OpenStackExportPlan, OpenStackRemoteConsole,
    RebuildInstanceRequest, UpdateMetadataRequest,
};
pub use security_groups::{
    get_security_group, list_security_groups, OpenStackSecurityGroup, OpenStackSecurityGroupRule,
};
pub use volumes::{
    create_cinder_volume, create_volume_from_image, create_volume_from_snapshot, clone_cinder_volume,
    create_volume_transfer, accept_volume_transfer, delete_cinder_snapshot, delete_cinder_volume,
    delete_volume_transfer, extend_cinder_volume, get_cinder_snapshot, get_cinder_volume, get_volume_transfer,
    list_cinder_snapshots, list_volume_transfers, upload_volume_to_image, UploadVolumeToImageRequest,
    UploadVolumeToImageResponse,
    retype_cinder_volume, set_volume_bootable, snapshot_cinder_volume, update_cinder_volume,
    AcceptVolumeTransferRequest, CloneVolumeRequest, CreateVolumeFromImageRequest,
    CreateVolumeFromSnapshotRequest, CreateVolumeTransferRequest, ExtendVolumeRequest,
    OpenStackCreateVolumeRequest, OpenStackVolumeSnapshot, OpenStackVolumeTransfer, RetypeVolumeRequest,
    SnapshotVolumeRequest, UpdateVolumeRequest,
};
pub use keypairs_ops::{create_keypair, delete_keypair, CreateKeypairRequest};
pub use lifecycle::{
    attach_interface, backup_instance, detach_interface, instance_stack_hint,
    list_instance_interfaces, migrate_instance, rescue_instance, shelve_instance,
    unrescue_instance, unshelve_instance, AttachInterfaceRequest, BackupInstanceRequest,
    MigrateInstanceRequest, OpenStackInstanceInterface, RescueInstanceRequest,
};
pub use topology::{
    add_router_interface, create_network, create_port, create_router, create_subnet, delete_network,
    delete_port, delete_router, delete_subnet, get_port, get_router, get_subnet, list_ports, list_routers,
    list_subnets, remove_router_interface, update_network, update_port, update_router, update_subnet,
    AddRouterInterfaceRequest,
    CreateNetworkRequest, CreatePortRequest, CreateRouterRequest, CreateSubnetRequest,
    OpenStackPort, OpenStackPortCreated, OpenStackRouter, OpenStackSubnet,
    RemoveRouterInterfaceRequest, UpdateNetworkRequest, UpdatePortRequest, UpdateRouterRequest,
    UpdateSubnetRequest,
};
pub use quotas::{get_quota_summary, probe_cinder_reachable, update_quotas, OpenStackQuotaSummary, UpdateQuotasRequest};
pub use catalogs_ext::{
    create_server_group, delete_server_group, get_flavor, get_server_group, list_server_groups, list_volume_types,
    CreateServerGroupRequest, OpenStackServerGroup, OpenStackVolumeType,
};
pub use glance_meta::{
    add_image_member, delete_image_member, list_image_members, update_image_metadata,
    update_image_visibility, AddImageMemberRequest, OpenStackImageMember, UpdateImageMetadataRequest,
    UpdateImageVisibilityRequest,
};
pub use clouds::{list_configured_clouds, OpenStackCloudEntry};
pub use console_tunnel::{issue_console_token, remote_console_with_tunnel, resolve_console_token};
pub use security_groups::{
    create_security_group, create_security_group_rule, delete_security_group,
    delete_security_group_rule, CreateSecurityGroupRequest, CreateSecurityGroupRuleRequest,
};
pub use networking::{
    associate_floating_ip, create_floating_ip, delete_floating_ip, dissociate_floating_ip, get_floating_ip,
    list_floating_ips,
    list_instance_floating_ips, AssociateFloatingIpRequest, CreateFloatingIpRequest,
    OpenStackFloatingIp,
};
pub use resources::{
    create_flavor, create_instance, delete_flavor, enrich_instance_flavor, get_image, get_network, list_flavors,
    list_images, list_instance_volumes, list_cinder_volumes, list_keypairs, list_networks, snapshot_instance,
    wait_glance_image_by_name, CreateFlavorRequest, CreateInstanceRequest, CreateInstanceResponse,
    OpenStackAttachedVolume, OpenStackFlavor, OpenStackImage, OpenStackKeyPair, OpenStackNetwork,
};
