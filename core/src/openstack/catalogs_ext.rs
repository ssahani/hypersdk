// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

//! Cinder volume types and Nova server groups.

use osauth::services::{BLOCK_STORAGE, COMPUTE};
use serde::Deserialize;

use crate::config::OpenStackConfig;
use crate::LibvirtError;

use super::auth::{connect_session, map_json_err, map_osauth_err};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OpenStackVolumeType {
    pub id: String,
    pub name: String,
    pub is_public: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OpenStackServerGroup {
    pub id: String,
    pub name: String,
    pub policy: String,
    pub members: Vec<String>,
}

pub async fn list_volume_types(cfg: &OpenStackConfig) -> Result<Vec<OpenStackVolumeType>, LibvirtError> {
    let session = connect_session(cfg).await?;
    #[derive(Deserialize)]
    struct Resp {
        volume_types: Vec<VtJson>,
    }
    #[derive(Deserialize)]
    struct VtJson {
        id: String,
        name: String,
        #[serde(default)]
        is_public: bool,
    }
    let resp = session
        .get(BLOCK_STORAGE, &["types"])
        .send()
        .await
        .map_err(map_osauth_err)?;
    let body: Resp = resp.json().await.map_err(map_json_err)?;
    let mut out: Vec<_> = body
        .volume_types
        .into_iter()
        .map(|v| OpenStackVolumeType {
            id: v.id,
            name: v.name,
            is_public: v.is_public,
        })
        .collect();
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

pub async fn list_server_groups(cfg: &OpenStackConfig) -> Result<Vec<OpenStackServerGroup>, LibvirtError> {
    let session = connect_session(cfg).await?;
    #[derive(Deserialize)]
    struct Resp {
        server_groups: Vec<SgJson>,
    }
    #[derive(Deserialize)]
    struct SgJson {
        id: String,
        name: String,
        policy: String,
        #[serde(default)]
        members: Vec<String>,
    }
    let resp = session
        .get(COMPUTE, &["os-server-groups"])
        .send()
        .await
        .map_err(map_osauth_err)?;
    let body: Resp = resp.json().await.map_err(map_json_err)?;
    let mut out: Vec<_> = body
        .server_groups
        .into_iter()
        .map(|g| OpenStackServerGroup {
            id: g.id,
            name: g.name,
            policy: g.policy,
            members: g.members,
        })
        .collect();
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}
