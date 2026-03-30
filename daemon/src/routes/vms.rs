use axum::extract::{Path, State};
use axum::routing::{delete, get, post};
use axum::{Json, Router};

use virtspawn_core::libvirt::{clone, create, device, domain, resize};
use virtspawn_core::{
    audit, AttachDiskRequest, AuditEvent, CloneVmRequest, CreateVmRequest, LibvirtManager,
    RenameVmRequest, VmDetails, VmInfo,
};

use crate::error::{ok_json, AppError, Xml};

fn log_audit(action: &str, target: &str, result: &str) {
    let event = AuditEvent {
        timestamp: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        action: action.to_string(),
        target: target.to_string(),
        result: result.to_string(),
    };
    audit::write_audit_event(&event);
}

async fn list_vms(State(manager): State<LibvirtManager>) -> Result<Json<Vec<VmInfo>>, AppError> {
    let vms = manager.with_conn(domain::list_vms)?;
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
) -> Result<Xml, AppError> {
    let xml = manager.with_conn(|conn| domain::get_vm_xml(conn, &name))?;
    Ok(Xml(xml))
}

async fn start_vm(State(manager): State<LibvirtManager>, Path(name): Path<String>) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| domain::start_vm(conn, &name))?;
    log_audit("start", &name, "ok");
    Ok(ok_json("started", &name))
}

async fn stop_vm(State(manager): State<LibvirtManager>, Path(name): Path<String>) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| domain::stop_vm(conn, &name))?;
    log_audit("stop", &name, "ok");
    Ok(ok_json("stopped", &name))
}

async fn shutdown_vm(State(manager): State<LibvirtManager>, Path(name): Path<String>) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| domain::shutdown_vm(conn, &name))?;
    log_audit("shutdown", &name, "ok");
    Ok(ok_json("shutting down", &name))
}

async fn reboot_vm(State(manager): State<LibvirtManager>, Path(name): Path<String>) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| domain::reboot_vm(conn, &name))?;
    Ok(ok_json("rebooting", &name))
}

async fn pause_vm(State(manager): State<LibvirtManager>, Path(name): Path<String>) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| domain::pause_vm(conn, &name))?;
    Ok(ok_json("paused", &name))
}

async fn resume_vm(State(manager): State<LibvirtManager>, Path(name): Path<String>) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| domain::resume_vm(conn, &name))?;
    Ok(ok_json("resumed", &name))
}

async fn delete_vm_handler(State(manager): State<LibvirtManager>, Path(name): Path<String>) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| domain::delete_vm(conn, &name))?;
    log_audit("delete", &name, "ok");
    Ok(ok_json("deleted", &name))
}

async fn set_autostart(
    State(manager): State<LibvirtManager>,
    Path((name, enabled)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, AppError> {
    let autostart = enabled == "true" || enabled == "1";
    manager.with_conn(|conn| domain::set_autostart(conn, &name, autostart))?;
    Ok(Json(serde_json::json!({ "status": "ok", "name": name, "autostart": autostart })))
}

async fn clone_vm_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Json(req): Json<CloneVmRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| clone::clone_vm(conn, &name, &req.new_name))?;
    log_audit("clone", &format!("{name} -> {}", req.new_name), "ok");
    Ok(Json(serde_json::json!({ "status": "cloned", "source": name, "clone": req.new_name })))
}

async fn create_vm_handler(
    State(manager): State<LibvirtManager>,
    Json(req): Json<CreateVmRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name = req.name.clone();
    manager.with_conn(|conn| create::create_vm(conn, &req))?;
    log_audit("create", &name, "ok");
    Ok(ok_json("created", &name))
}

async fn set_vcpus(
    State(manager): State<LibvirtManager>,
    Path((name, count)): Path<(String, u32)>,
) -> Result<Json<serde_json::Value>, AppError> {
    virtspawn_core::validate::validate_vcpus(count)?;
    manager.with_conn(|conn| resize::set_vcpus(conn, &name, count))?;
    Ok(Json(serde_json::json!({ "status": "ok", "name": name, "vcpus": count })))
}

async fn set_memory(
    State(manager): State<LibvirtManager>,
    Path((name, mb)): Path<(String, u64)>,
) -> Result<Json<serde_json::Value>, AppError> {
    virtspawn_core::validate::validate_memory_mb(mb)?;
    manager.with_conn(|conn| resize::set_memory(conn, &name, mb))?;
    Ok(Json(serde_json::json!({ "status": "ok", "name": name, "memory_mb": mb })))
}

async fn attach_disk_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Json(req): Json<AttachDiskRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| device::attach_disk(conn, &name, &req))?;
    Ok(Json(serde_json::json!({ "status": "attached", "name": name, "target": req.target })))
}

async fn detach_disk_handler(
    State(manager): State<LibvirtManager>,
    Path((name, target)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| device::detach_disk(conn, &name, &target))?;
    Ok(Json(serde_json::json!({ "status": "detached", "name": name, "target": target })))
}

async fn rename_vm_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Json(req): Json<RenameVmRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| domain::rename_vm(conn, &name, &req.new_name))?;
    Ok(Json(serde_json::json!({ "status": "renamed", "old_name": name, "new_name": req.new_name })))
}

#[derive(serde::Deserialize)]
struct ResizeDiskRequest { size_gb: u64 }

async fn resize_disk_handler(
    State(manager): State<LibvirtManager>,
    Path((name, target)): Path<(String, String)>,
    Json(req): Json<ResizeDiskRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| device::resize_block_device(conn, &name, &target, req.size_gb))?;
    Ok(Json(serde_json::json!({ "status": "resized", "name": name, "target": target, "size_gb": req.size_gb })))
}

#[derive(serde::Deserialize)]
struct AttachInterfaceRequest {
    network: String,
    #[serde(default = "default_nic_model")]
    model: String,
}
fn default_nic_model() -> String { "virtio".to_string() }

async fn attach_interface_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Json(req): Json<AttachInterfaceRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| device::attach_interface(conn, &name, &req.network, &req.model))?;
    Ok(Json(serde_json::json!({ "status": "attached", "name": name, "network": req.network })))
}

async fn detach_interface_handler(
    State(manager): State<LibvirtManager>,
    Path((name, mac)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| device::detach_interface(conn, &name, &mac))?;
    Ok(Json(serde_json::json!({ "status": "detached", "name": name, "mac": mac })))
}

// ── VM Tags ────────────────────────────────────────────────────────

async fn get_vm_tags_handler(
    State(_m): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let tags = virtspawn_core::libvirt::extras::get_vm_tags(&name);
    Ok(Json(serde_json::json!({ "tags": tags })))
}

#[derive(serde::Deserialize)]
struct SetTagsRequest { tags: Vec<String> }

async fn set_vm_tags_handler(
    State(_m): State<LibvirtManager>,
    Path(name): Path<String>,
    Json(req): Json<SetTagsRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    virtspawn_core::libvirt::extras::set_vm_tags(&name, req.tags.clone())?;
    Ok(Json(serde_json::json!({ "status": "ok", "name": name, "tags": req.tags })))
}

pub fn vm_routes() -> Router<LibvirtManager> {
    Router::new()
        .route("/vms", get(list_vms))
        .route("/vms", post(create_vm_handler))
        .route("/vms/{name}", get(get_vm_details))
        .route("/vms/{name}", delete(delete_vm_handler))
        .route("/vms/{name}/xml", get(get_vm_xml))
        .route("/vms/{name}/start", post(start_vm))
        .route("/vms/{name}/stop", post(stop_vm))
        .route("/vms/{name}/shutdown", post(shutdown_vm))
        .route("/vms/{name}/reboot", post(reboot_vm))
        .route("/vms/{name}/pause", post(pause_vm))
        .route("/vms/{name}/resume", post(resume_vm))
        .route("/vms/{name}/clone", post(clone_vm_handler))
        .route("/vms/{name}/autostart/{enabled}", post(set_autostart))
        .route("/vms/{name}/vcpus/{count}", post(set_vcpus))
        .route("/vms/{name}/memory/{mb}", post(set_memory))
        .route("/vms/{name}/rename", post(rename_vm_handler))
        .route("/vms/{name}/disk/attach", post(attach_disk_handler))
        .route("/vms/{name}/disk/detach/{target}", post(detach_disk_handler))
        .route("/vms/{name}/disk/resize/{target}", post(resize_disk_handler))
        .route("/vms/{name}/nic/attach", post(attach_interface_handler))
        .route("/vms/{name}/nic/detach/{mac}", post(detach_interface_handler))
        .route("/vms/{name}/tags", get(get_vm_tags_handler).post(set_vm_tags_handler))
}
