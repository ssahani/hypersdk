//! Nova compute: list instances and lifecycle actions.

use std::collections::HashMap;

use openstack::compute::{RebootType, Server};
use openstack::Cloud;

use crate::config::OpenStackConfig;
use crate::LibvirtError;

use super::auth::{connect_session, effective_cloud_name_for_config};

/// Serializable instance row for API responses.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OpenStackInstance {
    pub id: String,
    pub name: String,
    pub status: String,
    pub power_state: String,
    pub flavor_id: Option<String>,
    pub flavor_name: Option<String>,
    pub availability_zone: String,
    pub project_id: Option<String>,
    pub key_name: Option<String>,
    pub image_id: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub ip_addresses: Vec<String>,
    pub security_groups: Vec<String>,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OpenStackConnectionStatus {
    pub enabled: bool,
    pub configured: bool,
    pub cloud_name: String,
    pub connected: bool,
    pub reachable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub instance_count: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_count: Option<usize>,
    pub glance_reachable: bool,
}

pub fn is_openstack_configured(cfg: &OpenStackConfig) -> bool {
    if !cfg.enabled {
        return false;
    }
    if !cfg.cloud_name.trim().is_empty() || !cfg.auth_url.trim().is_empty() {
        return true;
    }
    if cfg.use_env_auth {
        return true;
    }
    super::auth::resolve_clouds_yaml_path(cfg).is_some()
}

/// Connect to OpenStack using config (clouds.yaml cloud name, inline password, or OS_* env).
pub async fn connect_cloud(cfg: &OpenStackConfig) -> Result<Cloud, LibvirtError> {
    Ok(Cloud::from(connect_session(cfg).await?))
}

pub async fn test_connection(cfg: &OpenStackConfig) -> OpenStackConnectionStatus {
    let base = connection_status_skeleton(cfg);
    match connect_cloud(cfg).await {
        Ok(cloud) => {
            let servers = cloud.list_servers().await;
            let images = cloud.list_images().await;
            match (servers, images) {
                (Ok(servers), Ok(images)) => OpenStackConnectionStatus {
                    connected: true,
                    reachable: true,
                    instance_count: Some(servers.len()),
                    image_count: Some(images.len()),
                    glance_reachable: true,
                    ..base
                },
                (Ok(servers), Err(e)) => OpenStackConnectionStatus {
                    connected: true,
                    reachable: true,
                    instance_count: Some(servers.len()),
                    glance_reachable: false,
                    error: Some(format!("Glance: {}", map_openstack_err(e))),
                    ..base
                },
                (Err(e), _) => OpenStackConnectionStatus {
                    connected: true,
                    reachable: false,
                    error: Some(map_openstack_err(e).to_string()),
                    ..base
                },
            }
        }
        Err(e) => OpenStackConnectionStatus {
            error: Some(e.to_string()),
            ..base
        },
    }
}

pub fn connection_status_skeleton(cfg: &OpenStackConfig) -> OpenStackConnectionStatus {
    let cloud_name =
        effective_cloud_name_for_config(cfg).unwrap_or_else(|| cfg.cloud_name.clone());
    OpenStackConnectionStatus {
        enabled: cfg.enabled,
        configured: is_openstack_configured(cfg),
        cloud_name,
        connected: false,
        reachable: false,
        error: None,
        instance_count: None,
        image_count: None,
        glance_reachable: false,
    }
}

pub async fn list_instances(
    cfg: &OpenStackConfig,
    search: Option<&str>,
    status_filter: Option<&str>,
) -> Result<Vec<OpenStackInstance>, LibvirtError> {
    let cloud = connect_cloud(cfg).await?;
    let summaries = cloud.list_servers().await.map_err(map_openstack_err)?;
    let search_l = search.map(|s| s.trim().to_lowercase()).filter(|s| !s.is_empty());
    let status_l = status_filter
        .map(|s| s.trim().to_uppercase())
        .filter(|s| !s.is_empty());

    let flavor_cache = flavor_name_cache(&cloud).await;

    let mut out = Vec::with_capacity(summaries.len());
    for summary in summaries {
        let id = summary.id().to_string();
        let name = summary.name().to_string();
        if let Some(ref q) = search_l {
            if !name.to_lowercase().contains(q) && !id.to_lowercase().contains(q) {
                continue;
            }
        }
        let server = cloud.get_server(&id).await.map_err(map_openstack_err)?;
        let mut inst = instance_from_server(&server)?;
        if let Some(ref fid) = inst.flavor_id {
            if let Some(fname) = flavor_cache.get(fid) {
                inst.flavor_name = Some(fname.clone());
            }
        }
        if let Some(ref want) = status_l {
            if !inst.status.eq_ignore_ascii_case(want) {
                continue;
            }
        }
        out.push(inst);
    }
    Ok(out)
}

pub async fn get_instance(cfg: &OpenStackConfig, id: &str) -> Result<OpenStackInstance, LibvirtError> {
    let cloud = connect_cloud(cfg).await?;
    let server = cloud
        .get_server(id.trim())
        .await
        .map_err(map_openstack_err)?;
    instance_from_server(&server)
}

pub async fn start_instance(cfg: &OpenStackConfig, id: &str) -> Result<(), LibvirtError> {
    let cloud = connect_cloud(cfg).await?;
    let mut server = cloud.get_server(id).await.map_err(map_openstack_err)?;
    server.start().await.map_err(map_openstack_err)?;
    Ok(())
}

pub async fn stop_instance(cfg: &OpenStackConfig, id: &str) -> Result<(), LibvirtError> {
    let cloud = connect_cloud(cfg).await?;
    let mut server = cloud.get_server(id).await.map_err(map_openstack_err)?;
    server.stop().await.map_err(map_openstack_err)?;
    Ok(())
}

pub async fn reboot_instance(
    cfg: &OpenStackConfig,
    id: &str,
    soft: bool,
) -> Result<(), LibvirtError> {
    let cloud = connect_cloud(cfg).await?;
    let mut server = cloud.get_server(id).await.map_err(map_openstack_err)?;
    let reboot_type = if soft {
        RebootType::Soft
    } else {
        RebootType::Hard
    };
    server.reboot(reboot_type).await.map_err(map_openstack_err)?;
    Ok(())
}

pub async fn delete_instance(cfg: &OpenStackConfig, id: &str) -> Result<(), LibvirtError> {
    let cloud = connect_cloud(cfg).await?;
    let server = cloud.get_server(id).await.map_err(map_openstack_err)?;
    server.delete().await.map_err(map_openstack_err)?;
    Ok(())
}

fn instance_from_server(server: &Server) -> Result<OpenStackInstance, LibvirtError> {
    let status = format!("{:?}", server.status());
    let power_state = format!("{:?}", server.power_state());
    let mut ips = Vec::new();
    for addrs in server.addresses().values() {
        for a in addrs {
            ips.push(a.addr.to_string());
        }
    }

    let mut security_groups = Vec::new();
    if let Some(sg) = server.metadata().get("security_groups") {
        for part in sg.split(',') {
            let t = part.trim();
            if !t.is_empty() {
                security_groups.push(t.to_string());
            }
        }
    }

    let flavor_id = server.flavor_id().cloned();
    let flavor_name = None; // resolved on detail fetch if needed

    Ok(OpenStackInstance {
        id: server.id().clone(),
        name: server.name().clone(),
        status: normalize_status(&status),
        power_state: power_state.to_lowercase(),
        flavor_id,
        flavor_name,
        availability_zone: server.availability_zone().clone(),
        project_id: server.metadata().get("project_id").cloned(),
        key_name: server.key_pair_name().as_ref().cloned(),
        image_id: server.image_id().cloned(),
        created_at: Some(server.created_at().to_rfc3339()),
        updated_at: Some(server.updated_at().to_rfc3339()),
        ip_addresses: ips,
        security_groups,
        metadata: server.metadata().clone(),
    })
}

fn normalize_status(debug_status: &str) -> String {
    // ServerStatus debug format may be "Active" or "ACTIVE"
    let s = debug_status.trim();
    if s.chars().all(|c| c.is_uppercase() || c == '_') {
        s.to_string()
    } else {
        // PascalCase → SHOUTY_SNAKE
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

pub(crate) async fn flavor_name_cache(cloud: &Cloud) -> HashMap<String, String> {
    let mut cache = HashMap::new();
    if let Ok(summaries) = cloud.list_flavors().await {
        for summary in summaries {
            if let Ok(flavor) = summary.details().await {
                cache.insert(flavor.id().clone(), flavor.name().clone());
            }
        }
    }
    cache
}

pub(crate) use super::auth::map_osauth_err as map_openstack_err;
