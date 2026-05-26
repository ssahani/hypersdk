// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pull: Option<super::glance::GlancePullResult>,
    pub steps: Vec<String>,
    pub hypervisord_dashboard: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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
        image_id: None,
        pull: None,
        steps: vec![
            "Glance image is being created from the instance snapshot.".into(),
            "When status is active, pull from OpenStack → Glance images or POST /openstack/images/{id}/pull.".into(),
            "Then use Import VM or Create VM with the qcow2 on this host.".into(),
            "For bulk migrations use HyperSDK (Machina → OpenStack migrations or hypervisord :5080).".into(),
        ],
        hypervisord_dashboard: hypersdk_dashboard_url(cfg),
    })
}

/// Snapshot Nova instance → wait for Glance ACTIVE → stream image to hypervisor disk.
pub async fn export_instance_to_disk(
    cfg: &OpenStackConfig,
    id: &str,
    image_name: Option<&str>,
    dest_path: &str,
    allowed_prefixes: &[String],
    wait_for_active: bool,
) -> Result<OpenStackExportPlan, LibvirtError> {
    let server = server_mut(cfg, id).await?;
    let name = server.name().clone();
    let snap_name = image_name
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| format!("{name}-export"));
    super::resources::snapshot_instance(cfg, id, &snap_name).await?;
    let timeout = std::time::Duration::from_secs(cfg.upload_timeout_secs.max(120));
    let image_id =
        super::resources::wait_glance_image_by_name(cfg, &snap_name, timeout).await?;
    let pull = super::pull::pull_glance_image_to_disk(
        cfg,
        &image_id,
        &super::glance::GlancePullRequest {
            dest_path: dest_path.to_string(),
            wait_for_active: Some(wait_for_active),
        },
        allowed_prefixes,
    )
    .await?;
    Ok(OpenStackExportPlan {
        instance_id: server.id().clone(),
        instance_name: name.clone(),
        suggested_image_name: snap_name.clone(),
        image_id: Some(image_id),
        pull: Some(pull.clone()),
        steps: vec![
            format!("Snapshot {snap_name} created in Glance."),
            format!("Downloaded {} bytes to {}.", pull.bytes_written, pull.dest_path),
            "Open Import VM to define a libvirt domain from this disk.".into(),
        ],
        hypervisord_dashboard: hypersdk_dashboard_url(cfg),
    })
}

fn hypersdk_dashboard_url(cfg: &OpenStackConfig) -> String {
    let base = cfg
        .hypersdk_base_url
        .trim()
        .trim_end_matches('/');
    if base.is_empty() {
        "https://127.0.0.1:5080/web/dashboard/".into()
    } else {
        format!("{base}/web/dashboard/")
    }
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
