use axum::extract::{Path, State};
use axum::routing::{delete, get, post};
use axum::{Json, Router};

use virtspawn_core::libvirt::network;
use virtspawn_core::{CreateNetworkRequest, LibvirtManager, NetworkInfo};

use crate::error::{ok_json, AppError, Xml};

async fn list_networks(
    State(manager): State<LibvirtManager>,
) -> Result<Json<Vec<NetworkInfo>>, AppError> {
    let nets = manager.with_conn(network::list_networks)?;
    Ok(Json(nets))
}

async fn create_network(
    State(manager): State<LibvirtManager>,
    Json(req): Json<CreateNetworkRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name = req.name.clone();
    manager.with_conn(|conn| {
        network::create_network(conn, &req.name, &req.subnet, &req.dhcp_start, &req.dhcp_end)
    })?;
    Ok(ok_json("created", &name))
}

async fn delete_network_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| network::delete_network(conn, &name))?;
    Ok(ok_json("deleted", &name))
}

async fn start_network(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| network::start_network(conn, &name))?;
    Ok(ok_json("started", &name))
}

async fn stop_network(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| network::stop_network(conn, &name))?;
    Ok(ok_json("stopped", &name))
}

async fn get_network_xml(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Xml, AppError> {
    let xml = manager.with_conn(|conn| network::get_network_xml(conn, &name))?;
    Ok(Xml(xml))
}

async fn set_network_autostart(
    State(manager): State<LibvirtManager>,
    Path((name, enabled)): Path<(String, bool)>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| network::set_network_autostart(conn, &name, enabled))?;
    let label = if enabled { "enabled" } else { "disabled" };
    Ok(ok_json(label, &name))
}

pub fn network_routes() -> Router<LibvirtManager> {
    Router::new()
        .route("/networks", get(list_networks))
        .route("/networks", post(create_network))
        .route("/networks/{name}", delete(delete_network_handler))
        .route("/networks/{name}/start", post(start_network))
        .route("/networks/{name}/stop", post(stop_network))
        .route("/networks/{name}/xml", get(get_network_xml))
        .route("/networks/{name}/autostart/{enabled}", post(set_network_autostart))
}
