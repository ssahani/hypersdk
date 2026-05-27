// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

//! Nova/Cinder/Neutron limits and quota usage (read-only).

use osauth::services::{BLOCK_STORAGE, COMPUTE, NETWORK};
use serde::Deserialize;

use crate::config::OpenStackConfig;
use crate::LibvirtError;

use super::auth::{connect_session, map_json_err, map_osauth_err};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OpenStackQuotaSummary {
    pub compute: serde_json::Value,
    pub cinder: Option<serde_json::Value>,
    pub neutron: Option<serde_json::Value>,
}

fn resolve_project_id_from_env() -> Option<String> {
    for key in ["OS_PROJECT_ID", "OS_TENANT_ID"] {
        if let Ok(id) = std::env::var(key) {
            let t = id.trim();
            if !t.is_empty() {
                return Some(t.to_string());
            }
        }
    }
    None
}

async fn resolve_project_id_from_nova(session: &osauth::Session) -> Option<String> {
    #[derive(Deserialize)]
    struct ListResp {
        servers: Vec<ServerRow>,
    }
    #[derive(Deserialize)]
    struct ServerRow {
        #[serde(default)]
        tenant_id: Option<String>,
        #[serde(default)]
        project_id: Option<String>,
    }
    let resp = session
        .get(COMPUTE, &["servers"])
        .query(&[("limit", "1")])
        .send()
        .await
        .ok()?;
    let body: ListResp = resp.json().await.ok()?;
    body.servers
        .into_iter()
        .find_map(|s| {
            s.tenant_id
                .or(s.project_id)
                .map(|id| id.trim().to_string())
                .filter(|id| !id.is_empty())
        })
}

async fn resolve_project_id(session: &osauth::Session) -> Option<String> {
    if let Some(id) = resolve_project_id_from_env() {
        return Some(id);
    }
    resolve_project_id_from_nova(session).await
}

async fn fetch_neutron_quotas(session: &osauth::Session) -> Option<serde_json::Value> {
    let project_id = resolve_project_id(session).await?;
    session
        .get(NETWORK, &["quotas", &project_id, "details"])
        .send()
        .await
        .ok()?
        .json()
        .await
        .ok()
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

    let neutron = fetch_neutron_quotas(&session).await;

    Ok(OpenStackQuotaSummary {
        compute: compute.limits,
        cinder,
        neutron,
    })
}
