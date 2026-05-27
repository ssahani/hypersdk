// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

//! Read-only Nova/Neutron admin catalog (hypervisors, AZs, agents).

use osauth::services::{COMPUTE, NETWORK};
use serde::Deserialize;

use crate::config::OpenStackConfig;
use crate::LibvirtError;

use super::auth::{connect_session, map_json_err, map_osauth_err};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OpenStackAvailabilityZone {
    pub name: String,
    pub state: String,
    pub hosts: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OpenStackHypervisor {
    pub id: String,
    pub hostname: String,
    pub state: String,
    pub status: String,
    pub vcpus: u32,
    pub vcpus_used: u32,
    pub memory_mb: u64,
    pub memory_mb_used: u64,
    pub running_vms: u32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OpenStackComputeService {
    pub id: String,
    pub binary: String,
    pub host: String,
    pub zone: String,
    pub state: String,
    pub status: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OpenStackNeutronAgent {
    pub id: String,
    pub agent_type: String,
    pub host: String,
    pub alive: bool,
    pub admin_state_up: bool,
}

pub async fn list_availability_zones(
    cfg: &OpenStackConfig,
) -> Result<Vec<OpenStackAvailabilityZone>, LibvirtError> {
    let session = connect_session(cfg).await?;
    #[derive(Deserialize)]
    struct Resp {
        availabilityZoneInfo: Vec<AzJson>,
    }
    #[derive(Deserialize)]
    struct AzJson {
        zoneName: String,
        zoneState: ZoneState,
        #[serde(default)]
        hosts: serde_json::Value,
    }
    #[derive(Deserialize)]
    struct ZoneState {
        available: bool,
    }
    let resp = session
        .get(COMPUTE, &["os-availability-zone"])
        .send()
        .await
        .map_err(map_osauth_err)?;
    let body: Resp = resp.json().await.map_err(map_json_err)?;
    let mut out = Vec::new();
    for az in body.availabilityZoneInfo {
        let hosts = match az.hosts {
            serde_json::Value::Object(map) => map.keys().cloned().collect(),
            _ => Vec::new(),
        };
        out.push(OpenStackAvailabilityZone {
            name: az.zoneName,
            state: if az.zoneState.available {
                "available".into()
            } else {
                "unavailable".into()
            },
            hosts,
        });
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

pub async fn list_hypervisors(cfg: &OpenStackConfig) -> Result<Vec<OpenStackHypervisor>, LibvirtError> {
    let session = connect_session(cfg).await?;
    #[derive(Deserialize)]
    struct Resp {
        hypervisors: Vec<HvJson>,
    }
    #[derive(Deserialize)]
    struct HvJson {
        id: u64,
        hypervisor_hostname: String,
        state: String,
        status: String,
        vcpus: u32,
        vcpus_used: u32,
        memory_mb: u64,
        memory_mb_used: u64,
        running_vms: u32,
    }
    let resp = session
        .get(COMPUTE, &["os-hypervisors", "detail"])
        .send()
        .await
        .map_err(map_osauth_err)?;
    let body: Resp = resp.json().await.map_err(map_json_err)?;
    let mut out: Vec<_> = body
        .hypervisors
        .into_iter()
        .map(|h| OpenStackHypervisor {
            id: h.id.to_string(),
            hostname: h.hypervisor_hostname,
            state: h.state,
            status: h.status,
            vcpus: h.vcpus,
            vcpus_used: h.vcpus_used,
            memory_mb: h.memory_mb,
            memory_mb_used: h.memory_mb_used,
            running_vms: h.running_vms,
        })
        .collect();
    out.sort_by(|a, b| a.hostname.cmp(&b.hostname));
    Ok(out)
}

pub async fn list_compute_services(
    cfg: &OpenStackConfig,
) -> Result<Vec<OpenStackComputeService>, LibvirtError> {
    let session = connect_session(cfg).await?;
    #[derive(Deserialize)]
    struct Resp {
        services: Vec<SvcJson>,
    }
    #[derive(Deserialize)]
    struct SvcJson {
        id: u64,
        binary: String,
        host: String,
        zone: String,
        state: String,
        status: String,
    }
    let resp = session
        .get(COMPUTE, &["os-services"])
        .send()
        .await
        .map_err(map_osauth_err)?;
    let body: Resp = resp.json().await.map_err(map_json_err)?;
    let mut out: Vec<_> = body
        .services
        .into_iter()
        .map(|s| OpenStackComputeService {
            id: s.id.to_string(),
            binary: s.binary,
            host: s.host,
            zone: s.zone,
            state: s.state,
            status: s.status,
        })
        .collect();
    out.sort_by(|a, b| a.binary.cmp(&b.binary).then(a.host.cmp(&b.host)));
    Ok(out)
}

pub async fn list_neutron_agents(cfg: &OpenStackConfig) -> Result<Vec<OpenStackNeutronAgent>, LibvirtError> {
    let session = connect_session(cfg).await?;
    #[derive(Deserialize)]
    struct Resp {
        agents: Vec<AgentJson>,
    }
    #[derive(Deserialize)]
    struct AgentJson {
        id: String,
        agent_type: String,
        host: String,
        alive: bool,
        admin_state_up: bool,
    }
    let resp = session
        .get(NETWORK, &["agents"])
        .send()
        .await
        .map_err(map_osauth_err)?;
    let body: Resp = resp.json().await.map_err(map_json_err)?;
    let mut out: Vec<_> = body
        .agents
        .into_iter()
        .map(|a| OpenStackNeutronAgent {
            id: a.id,
            agent_type: a.agent_type,
            host: a.host,
            alive: a.alive,
            admin_state_up: a.admin_state_up,
        })
        .collect();
    out.sort_by(|a, b| a.agent_type.cmp(&b.agent_type).then(a.host.cmp(&b.host)));
    Ok(out)
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OpenStackHostAggregate {
    pub id: String,
    pub name: String,
    pub availability_zone: Option<String>,
    pub hosts: Vec<String>,
}

pub async fn list_host_aggregates(
    cfg: &OpenStackConfig,
) -> Result<Vec<OpenStackHostAggregate>, LibvirtError> {
    let session = connect_session(cfg).await?;
    #[derive(Deserialize)]
    struct Resp {
        aggregates: Vec<AggJson>,
    }
    #[derive(Deserialize)]
    struct AggJson {
        id: u64,
        name: String,
        #[serde(default)]
        availability_zone: Option<String>,
        #[serde(default)]
        hosts: Vec<String>,
    }
    let resp = session
        .get(COMPUTE, &["os-aggregates"])
        .send()
        .await
        .map_err(map_osauth_err)?;
    let body: Resp = resp.json().await.map_err(map_json_err)?;
    Ok(body
        .aggregates
        .into_iter()
        .map(|a| OpenStackHostAggregate {
            id: a.id.to_string(),
            name: a.name,
            availability_zone: a.availability_zone,
            hosts: a.hosts,
        })
        .collect())
}
