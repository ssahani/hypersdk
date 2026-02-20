use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};

use virtspawn_core::libvirt::node;
use virtspawn_core::{LibvirtManager, NodeInfo};

use crate::error::AppError;

async fn get_node_info(
    State(manager): State<LibvirtManager>,
) -> Result<Json<NodeInfo>, AppError> {
    let info = manager.with_conn(node::get_node_info)?;
    Ok(Json(info))
}

pub fn node_routes() -> Router<LibvirtManager> {
    Router::new().route("/node", get(get_node_info))
}
