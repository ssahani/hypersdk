// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

//! Glance images, Nova catalogs, instance create/snapshot.

use std::time::{Duration, Instant};

use openstack::compute::ServerAction;
use openstack::waiter::Waiter;
use tokio::time::sleep;

use crate::config::OpenStackConfig;
use crate::LibvirtError;

use super::compute::{connect_cloud, map_openstack_err, OpenStackInstance};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OpenStackFlavor {
    pub id: String,
    pub name: String,
    pub vcpus: u32,
    pub ram_mb: u64,
    pub disk_gb: u64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OpenStackNetwork {
    pub id: String,
    pub name: String,
    pub status: String,
    pub shared: bool,
    pub external: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OpenStackImage {
    pub id: String,
    pub name: String,
    pub status: String,
    pub min_disk_gb: u32,
    pub min_ram_mb: u32,
    pub size_bytes: Option<u64>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OpenStackKeyPair {
    pub name: String,
    pub fingerprint: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[derive(serde::Serialize)]
pub struct CreateInstanceRequest {
    pub name: String,
    pub flavor: String,
    pub image: Option<String>,
    /// Boot from an existing Cinder volume (mutually exclusive with image / new boot volume).
    pub boot_volume_id: Option<String>,
    /// Create a new boot volume from this Glance image (requires boot_volume_size_gb).
    pub boot_volume_image: Option<String>,
    pub boot_volume_size_gb: Option<u32>,
    pub network: Option<String>,
    /// Additional Neutron networks (multi-NIC). `network` is included when set.
    pub networks: Option<Vec<String>>,
    pub server_group: Option<String>,
    pub key_name: Option<String>,
    pub availability_zone: Option<String>,
    pub security_groups: Option<Vec<String>>,
    pub user_data: Option<String>,
    #[serde(default)]
    pub wait_until_active: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct CreateInstanceResponse {
    pub id: String,
    pub name: String,
    pub status: String,
}

pub async fn list_flavors(cfg: &OpenStackConfig) -> Result<Vec<OpenStackFlavor>, LibvirtError> {
    let cloud = connect_cloud(cfg).await?;
    let summaries = cloud.list_flavors().await.map_err(map_openstack_err)?;
    let mut out = Vec::with_capacity(summaries.len());
    for summary in summaries {
        let flavor = summary.details().await.map_err(map_openstack_err)?;
        out.push(OpenStackFlavor {
            id: flavor.id().clone(),
            name: flavor.name().clone(),
            vcpus: flavor.vcpu_count(),
            ram_mb: flavor.ram_size(),
            disk_gb: flavor.root_size(),
        });
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

pub async fn list_networks(cfg: &OpenStackConfig) -> Result<Vec<OpenStackNetwork>, LibvirtError> {
    let cloud = connect_cloud(cfg).await?;
    let networks = cloud.list_networks().await.map_err(map_openstack_err)?;
    let mut out = Vec::with_capacity(networks.len());
    for net in networks {
        out.push(OpenStackNetwork {
            id: net.id().clone(),
            name: net.name().clone().unwrap_or_default(),
            status: format!("{:?}", net.status()),
            shared: net.shared(),
            external: net.external().unwrap_or(false),
        });
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

pub async fn list_images(cfg: &OpenStackConfig) -> Result<Vec<OpenStackImage>, LibvirtError> {
    let cloud = connect_cloud(cfg).await?;
    let images = cloud.list_images().await.map_err(map_openstack_err)?;
    let mut out = Vec::new();
    for img in images {
        let status = format!("{:?}", img.status());
        if status.contains("Deleted") || status.contains("deleting") {
            continue;
        }
        out.push(OpenStackImage {
            id: img.id().clone(),
            name: img.name().clone(),
            status: normalize_debug_status(&status),
            min_disk_gb: img.minimum_required_disk(),
            min_ram_mb: img.minimum_required_ram(),
            size_bytes: img.size(),
            created_at: Some(img.created_at().to_rfc3339()),
        });
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

pub async fn list_keypairs(cfg: &OpenStackConfig) -> Result<Vec<OpenStackKeyPair>, LibvirtError> {
    let cloud = connect_cloud(cfg).await?;
    let pairs = cloud.list_keypairs().await.map_err(map_openstack_err)?;
    let mut out = Vec::with_capacity(pairs.len());
    for kp in pairs {
        out.push(OpenStackKeyPair {
            name: kp.name().clone(),
            fingerprint: Some(kp.fingerprint().to_string()),
        });
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

pub async fn create_instance(
    cfg: &OpenStackConfig,
    req: &CreateInstanceRequest,
) -> Result<CreateInstanceResponse, LibvirtError> {
    if req.name.trim().is_empty() {
        return Err(LibvirtError::Invalid("instance name is required".into()));
    }
    if req.flavor.trim().is_empty() {
        return Err(LibvirtError::Invalid("flavor is required".into()));
    }
    let boot_vol = req
        .boot_volume_id
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty());
    let boot_img = req
        .boot_volume_image
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty());
    let has_image = req
        .image
        .as_ref()
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    let boot_count = boot_vol.is_some() as u8 + boot_img.is_some() as u8 + has_image as u8;
    if boot_count != 1 {
        return Err(LibvirtError::Invalid(
            "set exactly one boot source: image, boot_volume_id, or boot_volume_image + boot_volume_size_gb"
                .into(),
        ));
    }
    if boot_img.is_some() && req.boot_volume_size_gb.unwrap_or(0) == 0 {
        return Err(LibvirtError::Invalid(
            "boot_volume_size_gb is required when boot_volume_image is set".into(),
        ));
    }
    let cloud = connect_cloud(cfg).await?;
    let name = req.name.trim().to_string();
    let mut builder = cloud.new_server(&name, req.flavor.trim());
    if let Some(vol_id) = boot_vol {
        builder = builder.with_boot_volume(vol_id);
    } else if let Some(img) = boot_img {
        let size = req.boot_volume_size_gb.unwrap_or(1);
        builder = builder.with_new_boot_volume(img, size);
    } else if let Some(ref image) = req.image {
        if !image.trim().is_empty() {
            builder.set_image(image.trim());
        }
    }
    let mut net_ids: Vec<String> = Vec::new();
    if let Some(ref network) = req.network {
        let n = network.trim();
        if !n.is_empty() {
            net_ids.push(n.to_string());
        }
    }
    if let Some(ref nets) = req.networks {
        for n in nets {
            let t = n.trim();
            if !t.is_empty() && !net_ids.iter().any(|x| x == t) {
                net_ids.push(t.to_string());
            }
        }
    }
    for net in net_ids {
        builder = builder.with_network(net.as_str());
    }
    if let Some(ref key) = req.key_name {
        if !key.trim().is_empty() {
            builder = builder.with_keypair(key.trim());
        }
    }
    if let Some(ref az) = req.availability_zone {
        if !az.trim().is_empty() {
            builder = builder.with_availability_zone(az.trim());
        }
    }
    if let Some(ref sg) = req.server_group {
        let g = sg.trim();
        if !g.is_empty() {
            builder
                .metadata()
                .insert("machina_server_group".into(), g.to_string());
        }
    }
    if let Some(ref ud) = req.user_data {
        if !ud.trim().is_empty() {
            builder = builder.with_user_data(ud.trim());
        }
    }
    let waiter = builder.create().await.map_err(map_openstack_err)?;
    let server = if req.wait_until_active {
        waiter.wait().await.map_err(|e| {
            let detail = map_openstack_err(e);
            LibvirtError::Operation(format!("instance did not reach ACTIVE: {detail}"))
        })?
    } else {
        waiter.current_state().clone()
    };
    let status_label = format!("{:?}", server.status());
    if status_label.contains("Error") {
        return Err(LibvirtError::Operation(format!(
            "instance '{}' entered ERROR — on the host: openstack server show {}",
            name,
            server.id()
        )));
    }
    if let Some(ref groups) = req.security_groups {
        for g in groups {
            let name = g.trim();
            if name.is_empty() {
                continue;
            }
            let mut s = cloud.get_server(server.id()).await.map_err(map_openstack_err)?;
            use openstack::compute::ServerAction;
            let _ = s
                .action(ServerAction::AddSecurityGroup {
                    name: name.to_string(),
                })
                .await
                .map_err(map_openstack_err);
        }
    }
    Ok(CreateInstanceResponse {
        id: server.id().clone(),
        name: server.name().clone(),
        status: format!("{:?}", server.status()),
    })
}

/// Poll Glance until an image with the given name reaches ACTIVE (Nova snapshot).
pub async fn wait_glance_image_by_name(
    cfg: &OpenStackConfig,
    image_name: &str,
    timeout: Duration,
) -> Result<String, LibvirtError> {
    let want = image_name.trim();
    if want.is_empty() {
        return Err(LibvirtError::Invalid("image_name is required".into()));
    }
    let start = Instant::now();
    loop {
        let images = list_images(cfg).await?;
        let mut matches: Vec<&OpenStackImage> = images.iter().filter(|i| i.name == want).collect();
        matches.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        if let Some(img) = matches.first() {
            let st = img.status.to_lowercase();
            if st == "active" {
                return Ok(img.id.clone());
            }
            if st == "killed" || st == "deleted" || st.contains("error") {
                return Err(LibvirtError::Operation(format!(
                    "Glance image '{want}' entered status {st}"
                )));
            }
        }
        if start.elapsed() > timeout {
            return Err(LibvirtError::Operation(format!(
                "timed out waiting for Glance image '{want}' to become active"
            )));
        }
        sleep(Duration::from_secs(5)).await;
    }
}

pub async fn snapshot_instance(
    cfg: &OpenStackConfig,
    id: &str,
    image_name: &str,
) -> Result<(), LibvirtError> {
    if image_name.trim().is_empty() {
        return Err(LibvirtError::Invalid("image_name is required".into()));
    }
    let cloud = connect_cloud(cfg).await?;
    let mut server = cloud.get_server(id).await.map_err(map_openstack_err)?;
    server
        .action(ServerAction::CreateImage {
            name: image_name.trim().to_string(),
            metadata: None,
        })
        .await
        .map_err(map_openstack_err)?;
    Ok(())
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OpenStackAttachedVolume {
    pub id: String,
    pub name: String,
    pub size_gb: u64,
    pub device: String,
    pub bootable: bool,
}

/// Cinder volumes attached to a Nova instance (read-only).
/// All Cinder volumes in the project (for attach UI).
pub async fn list_cinder_volumes(cfg: &OpenStackConfig) -> Result<Vec<OpenStackAttachedVolume>, LibvirtError> {
    let cloud = connect_cloud(cfg).await?;
    let volumes = cloud.list_volumes().await.map_err(map_openstack_err)?;
    let mut out = Vec::new();
    for vol in volumes {
        out.push(OpenStackAttachedVolume {
            id: vol.id().clone(),
            name: vol.name().clone(),
            size_gb: vol.size(),
            device: String::new(),
            bootable: vol.bootable(),
        });
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

pub async fn list_instance_volumes(
    cfg: &OpenStackConfig,
    instance_id: &str,
) -> Result<Vec<OpenStackAttachedVolume>, LibvirtError> {
    let cloud = connect_cloud(cfg).await?;
    let volumes = cloud.list_volumes().await.map_err(map_openstack_err)?;
    let mut out = Vec::new();
    for vol in volumes {
        for att in vol.attachments() {
            if att.server_id == instance_id {
                out.push(OpenStackAttachedVolume {
                    id: vol.id().clone(),
                    name: vol.name().clone(),
                    size_gb: vol.size(),
                    device: att.device.clone(),
                    bootable: vol.bootable(),
                });
            }
        }
    }
    out.sort_by(|a, b| a.device.cmp(&b.device));
    Ok(out)
}

pub async fn enrich_instance_flavor(
    cfg: &OpenStackConfig,
    mut inst: OpenStackInstance,
) -> OpenStackInstance {
    if inst.flavor_name.is_some() {
        return inst;
    }
    let Some(ref fid) = inst.flavor_id else {
        return inst;
    };
    if let Ok(cloud) = connect_cloud(cfg).await {
        if let Ok(flavor) = cloud.get_flavor(fid).await {
            inst.flavor_name = Some(flavor.name().clone());
        }
    }
    inst
}

fn normalize_debug_status(debug_status: &str) -> String {
    let s = debug_status.trim();
    if s.chars().all(|c| c.is_uppercase() || c == '_') {
        s.to_string()
    } else {
        s.chars()
            .enumerate()
            .flat_map(|(i, c)| {
                if c.is_uppercase() && i > 0 {
                    vec!['_', c]
                } else {
                    vec![c.to_ascii_uppercase()]
                }
            })
            .collect()
    }
}
