// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

//! Nova/Cinder limits and quota usage (read-only).

use osauth::services::{BLOCK_STORAGE, COMPUTE};
use serde::Deserialize;

use crate::config::OpenStackConfig;
use crate::LibvirtError;

use super::auth::{connect_session, map_json_err, map_osauth_err};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OpenStackQuotaSummary {
    pub compute: serde_json::Value,
    pub cinder: Option<serde_json::Value>,
}

/// True when Cinder block-storage is registered in the service catalog.
pub async fn probe_cinder_reachable(cfg: &OpenStackConfig) -> bool {
    let Ok(session) = connect_session(cfg).await else {
        return false;
    };
    session
        .get(BLOCK_STORAGE, &["limits"])
        .send()
        .await
        .is_ok()
}

pub async fn get_quota_summary(cfg: &OpenStackConfig) -> Result<OpenStackQuotaSummary, LibvirtError> {
    let session = connect_session(cfg).await?;
    let compute_resp = session
        .get(COMPUTE, &["limits"])
        .send()
        .await
        .map_err(map_osauth_err)?;
    #[derive(Deserialize)]
    struct LimitsResp {
        limits: serde_json::Value,
    }
    let compute: LimitsResp = compute_resp.json().await.map_err(map_json_err)?;

    let cinder = match session.get(BLOCK_STORAGE, &["limits"]).send().await {
        Ok(r) => r.json().await.ok(),
        Err(_) => None,
    };

    Ok(OpenStackQuotaSummary {
        compute: compute.limits,
        cinder,
    })
}
