use axum::extract::{Path, State};
use axum::routing::{delete, get, post};
use axum::{Json, Router};

use virtspawn_core::libvirt::domain;
use virtspawn_core::{LibvirtManager, VmInfo};

use crate::error::AppError;

async fn list_vms(State(manager): State<LibvirtManager>) -> Result<Json<Vec<VmInfo>>, AppError> {
    let vms = manager.with_conn(|conn| domain::list_vms(conn))?;
    Ok(Json(vms))
}

async fn start_vm(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| domain::start_vm(conn, &name))?;
    Ok(Json(serde_json::json!({ "status": "started", "name": name })))
}

async fn stop_vm(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| domain::stop_vm(conn, &name))?;
    Ok(Json(serde_json::json!({ "status": "stopped", "name": name })))
}

async fn delete_vm(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| domain::delete_vm(conn, &name))?;
    Ok(Json(serde_json::json!({ "status": "deleted", "name": name })))
}

pub fn vm_routes() -> Router<LibvirtManager> {
    Router::new()
        .route("/vms", get(list_vms))
        .route("/vms/{name}/start", post(start_vm))
        .route("/vms/{name}/stop", post(stop_vm))
        .route("/vms/{name}", delete(delete_vm))
}
