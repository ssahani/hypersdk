// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

//! Cinder volume create.

use crate::config::OpenStackConfig;
use crate::LibvirtError;

use super::compute::{connect_cloud, map_openstack_err};
use super::resources::OpenStackAttachedVolume;

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct OpenStackCreateVolumeRequest {
    pub size_gb: u64,
    pub name: Option<String>,
    pub description: Option<String>,
}

pub async fn create_cinder_volume(
    cfg: &OpenStackConfig,
    req: &OpenStackCreateVolumeRequest,
) -> Result<OpenStackAttachedVolume, LibvirtError> {
    if req.size_gb == 0 {
        return Err(LibvirtError::Invalid("size_gb must be > 0".into()));
    }
    let cloud = connect_cloud(cfg).await?;
    let mut builder = cloud.new_volume(req.size_gb);
    if let Some(ref name) = req.name {
        let n = name.trim();
        if !n.is_empty() {
            builder = builder.with_name(n.to_string());
        }
    }
    if let Some(ref desc) = req.description {
        let d = desc.trim();
        if !d.is_empty() {
            builder = builder.with_description(d);
        }
    }
    let vol = builder.create().await.map_err(map_openstack_err)?;
    Ok(OpenStackAttachedVolume {
        id: vol.id().clone(),
        name: vol.name().clone(),
        size_gb: vol.size(),
        device: String::new(),
        bootable: vol.bootable(),
    })
}

pub async fn delete_cinder_volume(cfg: &OpenStackConfig, volume_id: &str) -> Result<(), LibvirtError> {
    let id = volume_id.trim();
    if id.is_empty() {
        return Err(LibvirtError::Invalid("volume_id is required".into()));
    }
    let cloud = connect_cloud(cfg).await?;
    let vol = cloud.get_volume(id).await.map_err(map_openstack_err)?;
    vol.delete().await.map_err(map_openstack_err)?;
    Ok(())
}
