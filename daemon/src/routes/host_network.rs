use axum::extract::{Path, State};
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use serde::Deserialize;
use virtspawn_core::libvirt::host_network;
use virtspawn_core::LibvirtManager;

use crate::error::AppError;

// ── Host Interfaces ────────────────────────────────────────────────

async fn list_interfaces(
    State(_manager): State<LibvirtManager>,
) -> Result<Json<serde_json::Value>, AppError> {
    let interfaces = host_network::list_host_interfaces()?;
    Ok(Json(serde_json::json!(interfaces)))
}

async fn get_network_backends(
    State(_manager): State<LibvirtManager>,
) -> Result<Json<serde_json::Value>, AppError> {
    let (net_backend, fw_backend) = host_network::get_detected_backends();
    Ok(Json(serde_json::json!({
        "network_backend": net_backend,
        "firewall_backend": fw_backend,
    })))
}

// ── Bridges ────────────────────────────────────────────────────────

async fn create_bridge_handler(
    State(_manager): State<LibvirtManager>,
    Json(req): Json<host_network::CreateBridgeRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    host_network::create_bridge(&req)?;
    Ok(Json(serde_json::json!({ "status": "created", "name": req.name })))
}

async fn delete_bridge_handler(
    State(_manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    host_network::delete_bridge(&name)?;
    Ok(Json(serde_json::json!({ "status": "deleted", "name": name })))
}

// ── Port Forwarding ────────────────────────────────────────────────

async fn list_port_forwards(
    State(_manager): State<LibvirtManager>,
) -> Result<Json<serde_json::Value>, AppError> {
    let rules = host_network::list_port_forwards()?;
    Ok(Json(serde_json::json!(rules)))
}

async fn create_port_forward(
    State(_manager): State<LibvirtManager>,
    Json(req): Json<host_network::CreatePortForwardRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    host_network::create_port_forward(&req)?;
    Ok(Json(serde_json::json!({ "status": "created", "host_port": req.host_port, "vm_ip": req.vm_ip, "vm_port": req.vm_port })))
}

#[derive(Deserialize)]
struct DeletePortForwardRequest {
    protocol: String,
    host_port: u16,
    vm_ip: String,
    vm_port: u16,
}

async fn delete_port_forward(
    State(_manager): State<LibvirtManager>,
    Json(req): Json<DeletePortForwardRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    host_network::delete_port_forward(&req.protocol, req.host_port, &req.vm_ip, req.vm_port)?;
    Ok(Json(serde_json::json!({ "status": "deleted" })))
}

// ── Firewall Rules ─────────────────────────────────────────────────

async fn list_firewall_rules(
    State(_manager): State<LibvirtManager>,
) -> Result<Json<serde_json::Value>, AppError> {
    let rules = host_network::list_firewall_rules()?;
    Ok(Json(serde_json::json!(rules)))
}

async fn create_firewall_rule(
    State(_manager): State<LibvirtManager>,
    Json(req): Json<host_network::CreateFirewallRuleRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    host_network::create_firewall_rule(&req)?;
    Ok(Json(serde_json::json!({ "status": "created", "vm_ip": req.vm_ip, "action": req.action })))
}

async fn delete_firewall_rule(
    State(_manager): State<LibvirtManager>,
    Json(req): Json<host_network::CreateFirewallRuleRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    host_network::delete_firewall_rule(&req)?;
    Ok(Json(serde_json::json!({ "status": "deleted" })))
}

// ── Router ─────────────────────────────────────────────────────────

pub fn host_network_routes() -> Router<LibvirtManager> {
    Router::new()
        // Host interfaces + detected backends
        .route("/host/interfaces", get(list_interfaces))
        .route("/host/backends", get(get_network_backends))
        // Bridges
        .route("/host/bridges", post(create_bridge_handler))
        .route("/host/bridges/{name}", delete(delete_bridge_handler))
        // Port forwarding
        .route("/portforward", get(list_port_forwards).post(create_port_forward))
        .route("/portforward/delete", post(delete_port_forward))
        // Firewall
        .route("/firewall", get(list_firewall_rules).post(create_firewall_rule))
        .route("/firewall/delete", post(delete_firewall_rule))
}
