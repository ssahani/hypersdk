// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use machina_agent::pb::host_agent_client::HostAgentClient;
use machina_agent::pb::*;
use std::path::Path;
use tonic::transport::{Certificate, Channel, ClientTlsConfig, Endpoint, Identity};

pub fn normalize_agent_addr(addr: &str) -> String {
    let s = addr.trim();
    let s = s.strip_prefix("http://").unwrap_or(s);
    let s = s.strip_prefix("https://").unwrap_or(s);
    s.to_string()
}

pub async fn connect(addr: &str) -> anyhow::Result<HostAgentClient<Channel>> {
    let normalized = normalize_agent_addr(addr);
    let use_tls = std::env::var("MACHINA_AGENT_CA").ok().filter(|p| Path::new(p).exists());
    let endpoint_url = if use_tls.is_some() {
        format!("https://{normalized}")
    } else {
        format!("http://{normalized}")
    };
    let mut endpoint = Endpoint::from_shared(endpoint_url)?;
    if let Some(ca_path) = use_tls {
        let ca = tokio::fs::read_to_string(&ca_path).await?;
        let mut tls = ClientTlsConfig::new().ca_certificate(Certificate::from_pem(ca));
        if let (Ok(cert_path), Ok(key_path)) = (
            std::env::var("MACHINA_AGENT_CLIENT_CERT"),
            std::env::var("MACHINA_AGENT_CLIENT_KEY"),
        ) {
            if Path::new(&cert_path).exists() && Path::new(&key_path).exists() {
                let cert = tokio::fs::read_to_string(&cert_path).await?;
                let key = tokio::fs::read_to_string(&key_path).await?;
                tls = tls.identity(Identity::from_pem(cert, key));
            }
        }
        endpoint = endpoint.tls_config(tls)?;
    }
    let channel = endpoint.connect().await?;
    Ok(HostAgentClient::new(channel))
}

pub async fn list_vms(client: &mut HostAgentClient<Channel>) -> anyhow::Result<ListVmsResponse> {
    Ok(client.list_vms(ListVmsRequest {}).await?.into_inner())
}

pub async fn list_networks(client: &mut HostAgentClient<Channel>) -> anyhow::Result<ListNetworksResponse> {
    Ok(client.list_networks(ListNetworksRequest {}).await?.into_inner())
}

pub async fn list_storage_pools(
    client: &mut HostAgentClient<Channel>,
) -> anyhow::Result<ListStoragePoolsResponse> {
    Ok(client.list_storage_pools(ListStoragePoolsRequest {}).await?.into_inner())
}

pub async fn apply_vm(
    client: &mut HostAgentClient<Channel>,
    spec_json: &str,
    disk_path: &str,
    template_source: Option<&str>,
    cloud_init_user: &str,
    cloud_init_password: &str,
    cloud_init_ssh_pubkey: &str,
) -> anyhow::Result<ApplyVmResponse> {
    Ok(client
        .apply_vm(ApplyVmRequest {
            spec_json: spec_json.to_string(),
            disk_path: disk_path.to_string(),
            template_source: template_source.unwrap_or("").to_string(),
            cloud_init_user: cloud_init_user.to_string(),
            cloud_init_password: cloud_init_password.to_string(),
            cloud_init_ssh_pubkey: cloud_init_ssh_pubkey.to_string(),
        })
        .await?
        .into_inner())
}

pub async fn vm_power(
    client: &mut HostAgentClient<Channel>,
    vm_name: &str,
    action: &str,
) -> anyhow::Result<VmPowerResponse> {
    Ok(client
        .vm_power(VmPowerRequest {
            vm_name: vm_name.to_string(),
            action: action.to_string(),
        })
        .await?
        .into_inner())
}

pub async fn delete_vm(client: &mut HostAgentClient<Channel>, vm_name: &str) -> anyhow::Result<()> {
    client
        .delete_vm(DeleteVmRequest {
            vm_name: vm_name.to_string(),
        })
        .await?;
    Ok(())
}

pub async fn heartbeat(client: &mut HostAgentClient<Channel>, host_id: &str) -> anyhow::Result<HeartbeatResponse> {
    Ok(client
        .heartbeat(HeartbeatRequest {
            host_id: host_id.to_string(),
        })
        .await?
        .into_inner())
}

pub async fn get_console(
    client: &mut HostAgentClient<Channel>,
    vm_name: &str,
) -> anyhow::Result<GetConsoleResponse> {
    Ok(client
        .get_console(GetConsoleRequest {
            vm_name: vm_name.to_string(),
        })
        .await?
        .into_inner())
}

pub async fn migrate_vm(
    client: &mut HostAgentClient<Channel>,
    vm_name: &str,
    dest_uri: &str,
    live: bool,
) -> anyhow::Result<MigrateVmResponse> {
    Ok(client
        .migrate_vm(MigrateVmRequest {
            vm_name: vm_name.to_string(),
            dest_uri: dest_uri.to_string(),
            live,
        })
        .await?
        .into_inner())
}

pub async fn clone_vm(
    client: &mut HostAgentClient<Channel>,
    source: &str,
    new_name: &str,
) -> anyhow::Result<CloneVmResponse> {
    Ok(client
        .clone_vm(CloneVmRequest {
            source_name: source.to_string(),
            new_name: new_name.to_string(),
            spec_json: String::new(),
        })
        .await?
        .into_inner())
}

pub async fn maintenance(
    client: &mut HostAgentClient<Channel>,
    action: &str,
    evacuate: bool,
) -> anyhow::Result<MaintenanceResponse> {
    Ok(client
        .maintenance(MaintenanceRequest {
            action: action.to_string(),
            evacuate,
        })
        .await?
        .into_inner())
}

pub async fn get_host_info(
    client: &mut HostAgentClient<Channel>,
) -> anyhow::Result<GetHostInfoResponse> {
    Ok(client
        .get_host_info(GetHostInfoRequest {})
        .await?
        .into_inner())
}

pub async fn precheck_migrate(
    client: &mut HostAgentClient<Channel>,
    vm_name: &str,
    dest_cpu_model: &str,
    dest_libvirt_version: &str,
) -> anyhow::Result<PrecheckMigrateResponse> {
    Ok(client
        .precheck_migrate(PrecheckMigrateRequest {
            vm_name: vm_name.to_string(),
            dest_cpu_model: dest_cpu_model.to_string(),
            dest_libvirt_version: dest_libvirt_version.to_string(),
        })
        .await?
        .into_inner())
}

pub async fn fence_host(
    client: &mut HostAgentClient<Channel>,
    hostname: &str,
    method: &str,
    ipmi_address: &str,
    ipmi_username: &str,
    ipmi_password: &str,
    shell_command: &str,
) -> anyhow::Result<FenceHostResponse> {
    Ok(client
        .fence_host(FenceHostRequest {
            action: "fence".into(),
            method: method.to_string(),
            ipmi_address: ipmi_address.to_string(),
            ipmi_username: ipmi_username.to_string(),
            ipmi_password: ipmi_password.to_string(),
            shell_command: shell_command.to_string(),
            hostname: hostname.to_string(),
        })
        .await?
        .into_inner())
}

pub async fn create_snapshot(
    client: &mut HostAgentClient<Channel>,
    vm_name: &str,
    snapshot_name: &str,
    description: &str,
) -> anyhow::Result<CreateSnapshotResponse> {
    Ok(client
        .create_snapshot(CreateSnapshotRequest {
            vm_name: vm_name.to_string(),
            snapshot_name: snapshot_name.to_string(),
            description: description.to_string(),
        })
        .await?
        .into_inner())
}

pub async fn delete_snapshot(
    client: &mut HostAgentClient<Channel>,
    vm_name: &str,
    snapshot_name: &str,
) -> anyhow::Result<DeleteSnapshotResponse> {
    Ok(client
        .delete_snapshot(DeleteSnapshotRequest {
            vm_name: vm_name.to_string(),
            snapshot_name: snapshot_name.to_string(),
        })
        .await?
        .into_inner())
}

pub async fn list_snapshots(
    client: &mut HostAgentClient<Channel>,
    vm_name: &str,
) -> anyhow::Result<ListSnapshotsResponse> {
    Ok(client
        .list_snapshots(ListSnapshotsRequest {
            vm_name: vm_name.to_string(),
        })
        .await?
        .into_inner())
}

pub async fn backup_vm(
    client: &mut HostAgentClient<Channel>,
    vm_name: &str,
    dest_path: &str,
) -> anyhow::Result<BackupVmResponse> {
    Ok(client
        .backup_vm(BackupVmRequest {
            vm_name: vm_name.to_string(),
            dest_path: dest_path.to_string(),
        })
        .await?
        .into_inner())
}

pub async fn revert_snapshot(
    client: &mut HostAgentClient<Channel>,
    vm_name: &str,
    snapshot_name: &str,
) -> anyhow::Result<RevertSnapshotResponse> {
    Ok(client
        .revert_snapshot(RevertSnapshotRequest {
            vm_name: vm_name.to_string(),
            snapshot_name: snapshot_name.to_string(),
        })
        .await?
        .into_inner())
}

pub async fn restore_vm_backup(
    client: &mut HostAgentClient<Channel>,
    vm_name: &str,
    backup_path: &str,
) -> anyhow::Result<RestoreVmBackupResponse> {
    Ok(client
        .restore_vm_backup(RestoreVmBackupRequest {
            vm_name: vm_name.to_string(),
            backup_path: backup_path.to_string(),
        })
        .await?
        .into_inner())
}

pub async fn clone_from_snapshot(
    client: &mut HostAgentClient<Channel>,
    vm_name: &str,
    snapshot_name: &str,
    new_name: &str,
    new_disk_path: &str,
    revert_source: bool,
) -> anyhow::Result<CloneFromSnapshotResponse> {
    Ok(client
        .clone_from_snapshot(CloneFromSnapshotRequest {
            vm_name: vm_name.to_string(),
            snapshot_name: snapshot_name.to_string(),
            new_name: new_name.to_string(),
            new_disk_path: new_disk_path.to_string(),
            revert_source,
        })
        .await?
        .into_inner())
}

pub async fn provision_storage_pool(
    client: &mut HostAgentClient<Channel>,
    pool_name: &str,
    backend: &str,
    path: &str,
) -> anyhow::Result<()> {
    let resp = client
        .provision_storage_pool(ProvisionStoragePoolRequest {
            pool_name: pool_name.to_string(),
            backend: backend.to_string(),
            path: path.to_string(),
        })
        .await?
        .into_inner();
    if resp.ok {
        Ok(())
    } else {
        anyhow::bail!("{}", resp.message)
    }
}

pub async fn provision_network(
    client: &mut HostAgentClient<Channel>,
    network_name: &str,
    backend: &str,
    vlan_id: i32,
    bridge: &str,
) -> anyhow::Result<()> {
    let resp = client
        .provision_network(ProvisionNetworkRequest {
            network_name: network_name.to_string(),
            backend: backend.to_string(),
            vlan_id,
            bridge: bridge.to_string(),
        })
        .await?
        .into_inner();
    if resp.ok {
        Ok(())
    } else {
        anyhow::bail!("{}", resp.message)
    }
}

pub async fn attach_disk(
    client: &mut HostAgentClient<Channel>,
    vm_name: &str,
    disk_path: &str,
    target_dev: &str,
) -> anyhow::Result<()> {
    let resp = client
        .attach_disk(AttachDiskRequest {
            vm_name: vm_name.to_string(),
            disk_path: disk_path.to_string(),
            target_dev: target_dev.to_string(),
        })
        .await?
        .into_inner();
    if resp.ok {
        Ok(())
    } else {
        anyhow::bail!("{}", resp.message)
    }
}

#[derive(Debug, Clone)]
pub struct GuestHealthResult {
    pub agent_reachable: bool,
    pub healthy: bool,
    pub os_pretty_name: String,
    pub guest_ip: String,
    pub guest_hostname: String,
    pub issues: Vec<String>,
}

pub async fn get_guest_health(
    client: &mut HostAgentClient<Channel>,
    vm_name: &str,
) -> anyhow::Result<GuestHealthResult> {
    let resp = client
        .get_guest_health(GetGuestHealthRequest {
            vm_name: vm_name.to_string(),
        })
        .await?
        .into_inner();
    if resp.ok {
        Ok(GuestHealthResult {
            agent_reachable: resp.agent_reachable,
            healthy: resp.healthy,
            os_pretty_name: resp.os_pretty_name,
            guest_ip: resp.guest_ip,
            guest_hostname: resp.guest_hostname,
            issues: resp.issues,
        })
    } else {
        Ok(GuestHealthResult {
            agent_reachable: false,
            healthy: false,
            os_pretty_name: String::new(),
            guest_ip: String::new(),
            guest_hostname: String::new(),
            issues: resp.issues,
        })
    }
}

pub async fn install_guest_tools(
    client: &mut HostAgentClient<Channel>,
    vm_name: &str,
) -> anyhow::Result<()> {
    let resp = client
        .install_guest_tools(InstallGuestToolsRequest {
            vm_name: vm_name.to_string(),
        })
        .await?
        .into_inner();
    if resp.ok {
        Ok(())
    } else {
        anyhow::bail!(resp.message)
    }
}
