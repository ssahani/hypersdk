//! Multi-daemon fleet overview: peer health, aggregated VM lists, proxied lifecycle.

use axum::extract::{Extension, Path, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use machina_core::config::{FleetConfig, MachinaConfig};
use machina_core::{LibvirtManager, VmInfo};
use reqwest::Client;
use serde::Deserialize;
use serde_json::{json, Value};
use std::time::Duration;
use tracing::warn;

use crate::auth::{require_api_scope, RequestActor};
use crate::error::AppError;

#[derive(serde::Serialize)]
struct FleetPeerStatus {
    name: String,
    url: String,
    reachable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    vm_count: Option<usize>,
}

#[derive(serde::Serialize)]
struct FleetVmRow {
    name: String,
    state: String,
    peer: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    libvirt_connection: Option<String>,
}

fn fleet_cfg() -> FleetConfig {
    MachinaConfig::load().fleet
}

fn peer_client(peer: &machina_core::config::FleetPeer) -> Client {
    let mut b = Client::builder().timeout(Duration::from_secs(12));
    if peer.insecure_tls {
        b = b.danger_accept_invalid_certs(true);
    }
    b.build().unwrap_or_else(|_| Client::new())
}

async fn fetch_peer_json(
    peer: &machina_core::config::FleetPeer,
    path: &str,
) -> Result<Value, String> {
    let base = peer.url.trim().trim_end_matches('/');
    let url = format!("{base}/api/v1{path}");
    let client = peer_client(peer);
    let mut req = client.get(&url);
    let token = peer.api_token.trim();
    if !token.is_empty() {
        req = req.bearer_auth(token);
    }
    let res = req.send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("HTTP {}", res.status()));
    }
    res.json().await.map_err(|e| e.to_string())
}

async fn fleet_status() -> Json<Value> {
    let cfg = fleet_cfg();
    if !cfg.is_enabled() {
        return Json(json!({
            "enabled": false,
            "peers": [],
            "primary_peer": cfg.primary_peer,
            "standby_peer": cfg.standby_peer,
        }));
    }
    let mut peers = Vec::new();
    for p in &cfg.peers {
        let mut row = FleetPeerStatus {
            name: p.name.clone(),
            url: p.url.clone(),
            reachable: false,
            error: None,
            version: None,
            vm_count: None,
        };
        match fetch_peer_json(p, "/system/platform-info").await {
            Ok(info) => {
                row.reachable = true;
                row.version = info
                    .get("version")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                match fetch_peer_json(p, "/vms").await {
                    Ok(vms) => {
                        row.vm_count = vms.as_array().map(|a| a.len());
                    }
                    Err(e) => row.error = Some(format!("vms: {e}")),
                }
            }
            Err(e) => row.error = Some(e),
        }
        peers.push(row);
    }
    Json(json!({
        "enabled": true,
        "primary_peer": cfg.primary_peer,
        "standby_peer": cfg.standby_peer,
        "peers": peers
    }))
}

async fn fleet_vms(
    State(manager): State<LibvirtManager>,
) -> Result<Json<Value>, AppError> {
    let cfg = fleet_cfg();
    let mut rows: Vec<FleetVmRow> = Vec::new();

    let local = manager.list_all_vms()?;
    for vm in local {
        rows.push(FleetVmRow {
            name: vm.name.clone(),
            state: vm.state.clone(),
            peer: "local".to_string(),
            libvirt_connection: vm.libvirt_connection.clone(),
        });
    }

    if cfg.is_enabled() {
        for p in &cfg.peers {
            match fetch_peer_json(p, "/vms").await {
                Ok(vms) => {
                    if let Some(arr) = vms.as_array() {
                        for item in arr {
                            if let Ok(vm) = serde_json::from_value::<VmInfo>(item.clone()) {
                                rows.push(FleetVmRow {
                                    name: vm.name,
                                    state: vm.state,
                                    peer: p.name.clone(),
                                    libvirt_connection: vm.libvirt_connection,
                                });
                            }
                        }
                    }
                }
                Err(e) => warn!("fleet peer {} vms: {}", p.name, e),
            }
        }
    }

    Ok(Json(json!({ "enabled": cfg.is_enabled(), "vms": rows })))
}

#[derive(Deserialize)]
struct FleetProxyBody {
    method: String,
    path: String,
    #[serde(default)]
    body: Option<Value>,
}

async fn fleet_proxy_action(
    Extension(actor): Extension<RequestActor>,
    Path(peer_name): Path<String>,
    Json(req): Json<FleetProxyBody>,
) -> Result<Json<Value>, AppError> {
    require_api_scope(&actor, "fleet:proxy").map_err(AppError::from)?;
    if actor.role == machina_core::libvirt::automation::Role::ReadOnly {
        return Err(AppError::from(machina_core::LibvirtError::Forbidden(
            "Read-only role cannot proxy fleet actions".into(),
        )));
    }
    let cfg = fleet_cfg();
    if !cfg.is_enabled() {
        return Err(AppError::from(machina_core::LibvirtError::NotFound(
            "Fleet is not enabled".into(),
        )));
    }
    let peer = cfg
        .peers
        .iter()
        .find(|p| p.name == peer_name)
        .ok_or_else(|| {
            AppError::from(machina_core::LibvirtError::NotFound(format!(
                "Unknown fleet peer '{peer_name}'"
            )))
        })?;

    let method = req.method.to_uppercase();
    if !matches!(method.as_str(), "GET" | "POST" | "DELETE") {
        return Err(AppError::from(machina_core::LibvirtError::Invalid(
            "method must be GET, POST, or DELETE".into(),
        )));
    }
    let path = req.path.trim();
    if !path.starts_with('/') || path.contains("..") {
        return Err(AppError::from(machina_core::LibvirtError::Invalid(
            "path must start with / and must not contain ..".into(),
        )));
    }

    let base = peer.url.trim().trim_end_matches('/');
    let url = format!("{base}/api/v1{path}");
    let client = peer_client(peer);
    let mut rb = match method.as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "DELETE" => client.delete(&url),
        _ => unreachable!(),
    };
    let token = peer.api_token.trim();
    if !token.is_empty() {
        rb = rb.bearer_auth(token);
    }
    if let Some(body) = req.body {
        rb = rb.json(&body);
    }
    let res = rb
        .send()
        .await
        .map_err(|e| AppError::from(machina_core::LibvirtError::Operation(e.to_string())))?;
    let status = res.status().as_u16();
    let body: Value = res.json().await.unwrap_or(json!({}));
    Ok(Json(json!({ "peer": peer_name, "status": status, "body": body })))
}

pub fn fleet_routes() -> Router<LibvirtManager> {
    Router::new()
        .route("/fleet/status", get(fleet_status))
        .route("/fleet/vms", get(fleet_vms))
        .route("/fleet/peers/{peer}/proxy", post(fleet_proxy_action))
}
