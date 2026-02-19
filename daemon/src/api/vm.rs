use axum::extract::{Path, State};
use axum::Json;

use crate::error::AppError;
use crate::libvirt::domain;
use crate::libvirt::LibvirtManager;
use crate::models::VmInfo;

pub async fn list_vms(State(manager): State<LibvirtManager>) -> Result<Json<Vec<VmInfo>>, AppError> {
    let vms = manager.with_conn(|conn| domain::list_vms(conn))?;
    Ok(Json(vms))
}

pub async fn start_vm(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| domain::start_vm(conn, &name))?;
    Ok(Json(serde_json::json!({ "status": "started", "name": name })))
}

pub async fn stop_vm(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| domain::stop_vm(conn, &name))?;
    Ok(Json(serde_json::json!({ "status": "stopped", "name": name })))
}

pub async fn delete_vm(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| domain::delete_vm(conn, &name))?;
    Ok(Json(serde_json::json!({ "status": "deleted", "name": name })))
}
