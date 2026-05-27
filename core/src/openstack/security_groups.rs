// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

//! Neutron security groups (read-only).

use osauth::services::NETWORK;
use serde::Deserialize;

use crate::config::OpenStackConfig;
use crate::LibvirtError;

use super::auth::{connect_session, map_json_err, map_osauth_err};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OpenStackSecurityGroupRule {
    pub id: String,
    pub direction: String,
    pub protocol: Option<String>,
    pub port_range_min: Option<u16>,
    pub port_range_max: Option<u16>,
    pub remote_ip_prefix: Option<String>,
    pub remote_group_id: Option<String>,
    pub ethertype: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OpenStackSecurityGroup {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub rules: Vec<OpenStackSecurityGroupRule>,
}

#[derive(Deserialize)]
struct SgListResponse {
    security_groups: Vec<SgJson>,
}

#[derive(Deserialize)]
struct SgResponse {
    security_group: SgJson,
}

#[derive(Deserialize)]
struct SgJson {
    id: String,
    name: String,
    description: Option<String>,
    #[serde(default)]
    security_group_rules: Vec<SgRuleJson>,
}

#[derive(Deserialize)]
struct SgRuleJson {
    id: String,
    direction: String,
    protocol: Option<String>,
    #[serde(default)]
    port_range_min: Option<u16>,
    #[serde(default)]
    port_range_max: Option<u16>,
    remote_ip_prefix: Option<String>,
    remote_group_id: Option<String>,
    ethertype: Option<String>,
    description: Option<String>,
}

fn map_sg(sg: SgJson) -> OpenStackSecurityGroup {
    let rules = sg
        .security_group_rules
        .into_iter()
        .map(|r| OpenStackSecurityGroupRule {
            id: r.id,
            direction: r.direction,
            protocol: r.protocol,
            port_range_min: r.port_range_min,
            port_range_max: r.port_range_max,
            remote_ip_prefix: r.remote_ip_prefix,
            remote_group_id: r.remote_group_id,
            ethertype: r.ethertype,
            description: r.description,
        })
        .collect();
    OpenStackSecurityGroup {
        id: sg.id,
        name: sg.name,
        description: sg.description,
        rules,
    }
}

pub async fn list_security_groups(
    cfg: &OpenStackConfig,
) -> Result<Vec<OpenStackSecurityGroup>, LibvirtError> {
    let session = connect_session(cfg).await?;
    let resp = session
        .get(NETWORK, &["security-groups"])
        .send()
        .await
        .map_err(map_osauth_err)?;
    let body: SgListResponse = resp.json().await.map_err(map_json_err)?;
    let mut out: Vec<_> = body.security_groups.into_iter().map(map_sg).collect();
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

pub async fn get_security_group(
    cfg: &OpenStackConfig,
    id: &str,
) -> Result<OpenStackSecurityGroup, LibvirtError> {
    let sg_id = id.trim();
    if sg_id.is_empty() {
        return Err(LibvirtError::Invalid("security group id is required".into()));
    }
    let session = connect_session(cfg).await?;
    let resp = session
        .get(NETWORK, &["security-groups", sg_id])
        .send()
        .await
        .map_err(map_osauth_err)?;
    let body: SgResponse = resp.json().await.map_err(map_json_err)?;
    Ok(map_sg(body.security_group))
}
