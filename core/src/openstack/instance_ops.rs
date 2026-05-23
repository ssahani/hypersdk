//! Extended Nova operations: lifecycle, console, resize, Cinder attach/detach.

use openstack::compute::ServerAction;
use osauth::services::COMPUTE;
use serde::{Deserialize, Serialize};

use crate::config::OpenStackConfig;
use crate::LibvirtError;

use super::auth::{connect_session, map_osauth_err};
use super::compute::{connect_cloud, map_openstack_err};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenStackConsoleOutput {
    pub output: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenStackRemoteConsole {
    pub console_type: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenStackExportPlan {
    pub instance_id: String,
    pub instance_name: String,
    pub suggested_image_name: String,
    pub steps: Vec<String>,
    pub hypervisord_dashboard: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AttachVolumeRequest {
    pub volume_id: String,
}

async fn server_mut(cfg: &OpenStackConfig, id: &str) -> Result<openstack::compute::Server, LibvirtError> {
    let cloud = connect_cloud(cfg).await?;
    cloud
        .get_server(id.trim())
        .await
        .map_err(map_openstack_err)
}

pub async fn pause_instance(cfg: &OpenStackConfig, id: &str) -> Result<(), LibvirtError> {
    let mut server = server_mut(cfg, id).await?;
    server
        .action(ServerAction::Pause)
        .await
        .map_err(map_openstack_err)
}

pub async fn unpause_instance(cfg: &OpenStackConfig, id: &str) -> Result<(), LibvirtError> {
    let mut server = server_mut(cfg, id).await?;
    server
        .action(ServerAction::Unpause)
        .await
        .map_err(map_openstack_err)
}

pub async fn suspend_instance(cfg: &OpenStackConfig, id: &str) -> Result<(), LibvirtError> {
    let mut server = server_mut(cfg, id).await?;
    server
        .action(ServerAction::Suspend)
        .await
        .map_err(map_openstack_err)
}

pub async fn resume_instance(cfg: &OpenStackConfig, id: &str) -> Result<(), LibvirtError> {
    let mut server = server_mut(cfg, id).await?;
    server
        .action(ServerAction::Resume)
        .await
        .map_err(map_openstack_err)
}

pub async fn resize_instance(
    cfg: &OpenStackConfig,
    id: &str,
    flavor_id: &str,
) -> Result<(), LibvirtError> {
    if flavor_id.trim().is_empty() {
        return Err(LibvirtError::Invalid("flavor is required".into()));
    }
    let mut server = server_mut(cfg, id).await?;
    server
        .action(ServerAction::Resize {
            flavor_ref: flavor_id.trim().to_string(),
            disk_config: "AUTO".into(),
        })
        .await
        .map_err(map_openstack_err)?;
    server
        .action(ServerAction::ConfirmResize)
        .await
        .map_err(map_openstack_err)
}

pub async fn get_console_output(
    cfg: &OpenStackConfig,
    id: &str,
    tail_lines: Option<u64>,
) -> Result<OpenStackConsoleOutput, LibvirtError> {
    let server = server_mut(cfg, id).await?;
    let output = server
        .get_console_output(tail_lines)
        .await
        .map_err(map_openstack_err)?;
    Ok(OpenStackConsoleOutput { output })
}

/// Graphical/serial console URL (novnc, spice, rdp, serial, xvpvnc).
pub async fn get_remote_console(
    cfg: &OpenStackConfig,
    id: &str,
    console_type: &str,
) -> Result<OpenStackRemoteConsole, LibvirtError> {
    let session = connect_session(cfg).await?;
    let body = match console_type.trim().to_lowercase().as_str() {
        "spice" | "spice-html5" => serde_json::json!({ "os-getSPICEConsole": { "type": "spice-html5" } }),
        "serial" => serde_json::json!({ "os-getSerialConsole": { "type": "serial" } }),
        "rdp" | "rdp-html5" => serde_json::json!({ "os-getRDPConsole": { "type": "rdp-html5" } }),
        _ => serde_json::json!({ "os-getVNCConsole": { "type": "novnc" } }),
    };
    let resp: RemoteConsoleResponse = session
        .post(COMPUTE, &["servers", id.trim(), "action"])
        .json(&body)
        .send()
        .await
        .map_err(map_osauth_err)?
        .json()
        .await
        .map_err(map_reqwest_err)?;
    Ok(OpenStackRemoteConsole {
        console_type: resp.console.r#type,
        url: resp.console.url,
    })
}

#[derive(Debug, Deserialize)]
struct RemoteConsoleResponse {
    console: RemoteConsoleBody,
}

#[derive(Debug, Deserialize)]
struct RemoteConsoleBody {
    #[serde(rename = "type")]
    r#type: String,
    url: String,
}

pub async fn attach_volume(
    cfg: &OpenStackConfig,
    server_id: &str,
    volume_id: &str,
) -> Result<(), LibvirtError> {
    let vol = volume_id.trim();
    if vol.is_empty() {
        return Err(LibvirtError::Invalid("volume_id is required".into()));
    }
    let session = connect_session(cfg).await?;
    let body = serde_json::json!({
        "volumeAttachment": { "volumeId": vol }
    });
    session
        .post(COMPUTE, &["servers", server_id.trim(), "os-volume_attachments"])
        .json(&body)
        .send()
        .await
        .map_err(map_osauth_err)?;
    Ok(())
}

pub async fn detach_volume(
    cfg: &OpenStackConfig,
    server_id: &str,
    volume_id: &str,
) -> Result<(), LibvirtError> {
    let vol = volume_id.trim();
    if vol.is_empty() {
        return Err(LibvirtError::Invalid("volume_id is required".into()));
    }
    let session = connect_session(cfg).await?;
    session
        .delete(COMPUTE, &["servers", server_id.trim(), "os-volume_attachments", vol])
        .send()
        .await
        .map_err(map_osauth_err)?;
    Ok(())
}

/// Snapshot to Glance + documented pull path for libvirt import.
pub async fn export_instance_plan(
    cfg: &OpenStackConfig,
    id: &str,
    image_name: Option<&str>,
) -> Result<OpenStackExportPlan, LibvirtError> {
    let server = server_mut(cfg, id).await?;
    let name = server.name().clone();
    let snap_name = image_name
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| format!("{name}-export"));
    super::resources::snapshot_instance(cfg, id, &snap_name).await?;
    Ok(OpenStackExportPlan {
        instance_id: server.id().clone(),
        instance_name: name.clone(),
        suggested_image_name: snap_name,
        steps: vec![
            "Glance image is being created from the instance snapshot.".into(),
            "When status is active, download with: openstack image save <image> --file /path/on/host.qcow2".into(),
            "Place the qcow2 on a machina disk-images path, then use Import VM or Create VM.".into(),
            "For bulk migrations use HyperSDK (hypervisord :5080).".into(),
        ],
        hypervisord_dashboard: "https://127.0.0.1:5080/web/dashboard/".into(),
    })
}

pub async fn add_security_group(
    cfg: &OpenStackConfig,
    id: &str,
    group_name: &str,
) -> Result<(), LibvirtError> {
    let name = group_name.trim();
    if name.is_empty() {
        return Err(LibvirtError::Invalid("security group name is required".into()));
    }
    let mut server = server_mut(cfg, id).await?;
    server
        .action(ServerAction::AddSecurityGroup {
            name: name.to_string(),
        })
        .await
        .map_err(map_openstack_err)
}

pub async fn remove_security_group(
    cfg: &OpenStackConfig,
    id: &str,
    group_name: &str,
) -> Result<(), LibvirtError> {
    let name = group_name.trim();
    if name.is_empty() {
        return Err(LibvirtError::Invalid("security group name is required".into()));
    }
    let mut server = server_mut(cfg, id).await?;
    server
        .action(ServerAction::RemoveSecurityGroup {
            name: name.to_string(),
        })
        .await
        .map_err(map_openstack_err)
}

fn map_reqwest_err(e: reqwest::Error) -> LibvirtError {
    LibvirtError::Operation(e.to_string())
}
