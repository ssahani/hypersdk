use axum::extract::{Path, State};
use axum::routing::{get, post};
use axum::{Json, Router};

use virtspawn_core::libvirt::network;
use virtspawn_core::{LibvirtManager, NetworkInfo};

use crate::error::AppError;

async fn list_networks(
    State(manager): State<LibvirtManager>,
) -> Result<Json<Vec<NetworkInfo>>, AppError> {
    let nets = manager.with_conn(|conn| network::list_networks(conn))?;
    Ok(Json(nets))
}

async fn start_network(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| network::start_network(conn, &name))?;
    Ok(Json(serde_json::json!({ "status": "started", "name": name })))
}

async fn stop_network(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| network::stop_network(conn, &name))?;
    Ok(Json(serde_json::json!({ "status": "stopped", "name": name })))
}

async fn get_network_xml(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<String, AppError> {
    let xml = manager.with_conn(|conn| network::get_network_xml(conn, &name))?;
    Ok(xml)
}

pub fn network_routes() -> Router<LibvirtManager> {
    Router::new()
        .route("/networks", get(list_networks))
        .route("/networks/{name}/start", post(start_network))
        .route("/networks/{name}/stop", post(stop_network))
        .route("/networks/{name}/xml", get(get_network_xml))
}
