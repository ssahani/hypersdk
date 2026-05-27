// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

//! Neutron subnets, routers, ports (read-only).

use osauth::services::NETWORK;
use serde::Deserialize;

use crate::config::OpenStackConfig;
use crate::LibvirtError;

use super::auth::{connect_session, map_json_err, map_osauth_err};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OpenStackSubnet {
    pub id: String,
    pub name: String,
    pub network_id: String,
    pub cidr: String,
    pub ip_version: u8,
    pub gateway_ip: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OpenStackRouter {
    pub id: String,
    pub name: String,
    pub status: String,
    pub external_gateway: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OpenStackPort {
    pub id: String,
    pub name: String,
    pub network_id: String,
    pub status: String,
    pub device_id: Option<String>,
    pub fixed_ips: Vec<String>,
}

pub async fn list_subnets(cfg: &OpenStackConfig) -> Result<Vec<OpenStackSubnet>, LibvirtError> {
    let session = connect_session(cfg).await?;
    #[derive(Deserialize)]
    struct Resp {
        subnets: Vec<SubnetJson>,
    }
    #[derive(Deserialize)]
    struct SubnetJson {
        id: String,
        name: String,
        network_id: String,
        cidr: String,
        ip_version: u8,
        gateway_ip: Option<String>,
    }
    let resp = session.get(NETWORK, &["subnets"]).send().await.map_err(map_osauth_err)?;
    let body: Resp = resp.json().await.map_err(map_json_err)?;
    let mut out: Vec<_> = body
        .subnets
        .into_iter()
        .map(|s| OpenStackSubnet {
            id: s.id,
            name: s.name,
            network_id: s.network_id,
            cidr: s.cidr,
            ip_version: s.ip_version,
            gateway_ip: s.gateway_ip,
        })
        .collect();
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

pub async fn list_routers(cfg: &OpenStackConfig) -> Result<Vec<OpenStackRouter>, LibvirtError> {
    let session = connect_session(cfg).await?;
    #[derive(Deserialize)]
    struct Resp {
        routers: Vec<RouterJson>,
    }
    #[derive(Deserialize)]
    struct RouterJson {
        id: String,
        name: String,
        status: String,
        #[serde(default)]
        external_gateway_info: Option<serde_json::Value>,
    }
    let resp = session.get(NETWORK, &["routers"]).send().await.map_err(map_osauth_err)?;
    let body: Resp = resp.json().await.map_err(map_json_err)?;
    let mut out: Vec<_> = body
        .routers
        .into_iter()
        .map(|r| OpenStackRouter {
            id: r.id,
            name: r.name,
            status: r.status,
            external_gateway: r.external_gateway_info.is_some(),
        })
        .collect();
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

pub async fn list_ports(
    cfg: &OpenStackConfig,
    device_id: Option<&str>,
) -> Result<Vec<OpenStackPort>, LibvirtError> {
    let session = connect_session(cfg).await?;
    let mut req = session.get(NETWORK, &["ports"]);
    if let Some(dev) = device_id {
        let d = dev.trim();
        if !d.is_empty() {
            req = req.query(&[("device_id", d)]);
        }
    }
    #[derive(Deserialize)]
    struct Resp {
        ports: Vec<PortJson>,
    }
    #[derive(Deserialize)]
    struct PortJson {
        id: String,
        name: String,
        network_id: String,
        status: String,
        device_id: Option<String>,
        #[serde(default)]
        fixed_ips: Vec<FixedIp>,
    }
    #[derive(Deserialize)]
    struct FixedIp {
        ip_address: String,
    }
    let resp = req.send().await.map_err(map_osauth_err)?;
    let body: Resp = resp.json().await.map_err(map_json_err)?;
    let mut out: Vec<_> = body
        .ports
        .into_iter()
        .map(|p| OpenStackPort {
            id: p.id,
            name: p.name,
            network_id: p.network_id,
            status: p.status,
            device_id: p.device_id,
            fixed_ips: p.fixed_ips.into_iter().map(|f| f.ip_address).collect(),
        })
        .collect();
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}
