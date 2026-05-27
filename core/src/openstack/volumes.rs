// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

//! Cinder volume create, extend, snapshot.

use osauth::services::BLOCK_STORAGE;

use crate::config::OpenStackConfig;
use crate::LibvirtError;

use super::auth::{connect_session, map_json_err, map_osauth_err};
use super::compute::{connect_cloud, map_openstack_err};
use super::resources::OpenStackAttachedVolume;

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct OpenStackCreateVolumeRequest {
    pub size_gb: u64,
    pub name: Option<String>,
    pub description: Option<String>,
    pub volume_type: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct ExtendVolumeRequest {
    pub new_size_gb: u64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct SnapshotVolumeRequest {
    pub name: String,
    pub force: Option<bool>,
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
    if let Some(ref vt) = req.volume_type {
        let t = vt.trim();
        if !t.is_empty() {
            builder = builder.with_volume_type(t);
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

pub async fn extend_cinder_volume(
    cfg: &OpenStackConfig,
    volume_id: &str,
    req: &ExtendVolumeRequest,
) -> Result<OpenStackAttachedVolume, LibvirtError> {
    if req.new_size_gb == 0 {
        return Err(LibvirtError::Invalid("new_size_gb must be > 0".into()));
    }
    let session = connect_session(cfg).await?;
    let body = serde_json::json!({ "os-extend": { "new_size": req.new_size_gb } });
    session
        .post(BLOCK_STORAGE, &["volumes", volume_id.trim(), "action"])
        .json(&body)
        .send()
        .await
        .map_err(map_osauth_err)?;
    let cloud = connect_cloud(cfg).await?;
    let vol = cloud.get_volume(volume_id).await.map_err(map_openstack_err)?;
    Ok(OpenStackAttachedVolume {
        id: vol.id().clone(),
        name: vol.name().clone(),
        size_gb: vol.size(),
        device: String::new(),
        bootable: vol.bootable(),
    })
}

pub async fn snapshot_cinder_volume(
    cfg: &OpenStackConfig,
    volume_id: &str,
    req: &SnapshotVolumeRequest,
) -> Result<serde_json::Value, LibvirtError> {
    let name = req.name.trim();
    if name.is_empty() {
        return Err(LibvirtError::Invalid("snapshot name is required".into()));
    }
    let session = connect_session(cfg).await?;
    let force = req.force.unwrap_or(false);
    let body = serde_json::json!({
        "snapshot": {
            "name": name,
            "force": force,
            "volume_id": volume_id.trim()
        }
    });
    let resp = session
        .post(BLOCK_STORAGE, &["snapshots"])
        .json(&body)
        .send()
        .await
        .map_err(map_osauth_err)?;
    let val: serde_json::Value = resp.json().await.map_err(map_json_err)?;
    Ok(val)
}
