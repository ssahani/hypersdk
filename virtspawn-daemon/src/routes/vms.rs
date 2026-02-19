use axum::extract::{Path, State};
use axum::routing::{delete, get, post};
use axum::{Json, Router};

use virtspawn_core::libvirt::domain;
use virtspawn_core::{LibvirtManager, VmDetails, VmInfo};

use crate::error::AppError;

async fn list_vms(State(manager): State<LibvirtManager>) -> Result<Json<Vec<VmInfo>>, AppError> {
    let vms = manager.with_conn(|conn| domain::list_vms(conn))?;
    Ok(Json(vms))
}

async fn get_vm_details(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<VmDetails>, AppError> {
    let details = manager.with_conn(|conn| domain::get_vm_details(conn, &name))?;
    Ok(Json(details))
}

async fn get_vm_xml(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<String, AppError> {
    let xml = manager.with_conn(|conn| domain::get_vm_xml(conn, &name))?;
    Ok(xml)
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

async fn shutdown_vm(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| domain::shutdown_vm(conn, &name))?;
    Ok(Json(serde_json::json!({ "status": "shutting down", "name": name })))
}

async fn reboot_vm(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| domain::reboot_vm(conn, &name))?;
    Ok(Json(serde_json::json!({ "status": "rebooting", "name": name })))
}

async fn pause_vm(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| domain::pause_vm(conn, &name))?;
    Ok(Json(serde_json::json!({ "status": "paused", "name": name })))
}

async fn resume_vm(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| domain::resume_vm(conn, &name))?;
    Ok(Json(serde_json::json!({ "status": "resumed", "name": name })))
}

async fn delete_vm_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| domain::delete_vm(conn, &name))?;
    Ok(Json(serde_json::json!({ "status": "deleted", "name": name })))
}

async fn set_autostart(
    State(manager): State<LibvirtManager>,
    Path((name, enabled)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, AppError> {
    let autostart = enabled == "true" || enabled == "1";
    manager.with_conn(|conn| domain::set_autostart(conn, &name, autostart))?;
    Ok(Json(serde_json::json!({ "status": "ok", "name": name, "autostart": autostart })))
}

pub fn vm_routes() -> Router<LibvirtManager> {
    Router::new()
        .route("/vms", get(list_vms))
        .route("/vms/{name}", get(get_vm_details))
        .route("/vms/{name}", delete(delete_vm_handler))
        .route("/vms/{name}/xml", get(get_vm_xml))
        .route("/vms/{name}/start", post(start_vm))
        .route("/vms/{name}/stop", post(stop_vm))
        .route("/vms/{name}/shutdown", post(shutdown_vm))
        .route("/vms/{name}/reboot", post(reboot_vm))
        .route("/vms/{name}/pause", post(pause_vm))
        .route("/vms/{name}/resume", post(resume_vm))
        .route("/vms/{name}/autostart/{enabled}", post(set_autostart))
}
