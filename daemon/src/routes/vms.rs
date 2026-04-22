use std::collections::HashMap;

use axum::extract::{Path, Query, State};
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use serde::Deserialize;

use virtspawn_core::libvirt::{block_jobs, clone, create, device, domain, resize};
use virtspawn_core::libvirt::domain::UndefineOptions;
use virtspawn_core::libvirt::resize::{CpuTuneInfo, MemTuneInfo};
use virtspawn_core::{
    audit, AttachDiskRequest, AuditEvent, CloneVmRequest, CreateVmRequest, LibvirtError,
    LibvirtManager, RenameVmRequest, VirtspawnConfig, VmCreateBackend, VmDetails, VmInfo,
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
    let result = tokio::task::spawn_blocking(move || manager.with_conn(domain::list_vms))
        .await
        .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?;
    Ok(Json(result?))
}

async fn get_vm_details(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<VmDetails>, AppError> {
    let result = tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| domain::get_vm_details(conn, &name))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?;
    Ok(Json(result?))
}

async fn get_vm_xml(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Xml, AppError> {
    let result = tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| domain::get_vm_xml(conn, &name))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?;
    Ok(Xml(result?))
}

async fn start_vm(State(manager): State<LibvirtManager>, Path(name): Path<String>) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    tokio::task::spawn_blocking(move || manager.with_conn(|conn| domain::start_vm(conn, &name2)))
        .await
        .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
        ?;
    log_audit("start", &name, "ok");
    Ok(ok_json("started", &name))
}

async fn stop_vm(State(manager): State<LibvirtManager>, Path(name): Path<String>) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    tokio::task::spawn_blocking(move || manager.with_conn(|conn| domain::stop_vm(conn, &name2)))
        .await
        .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
        ?;
    log_audit("stop", &name, "ok");
    Ok(ok_json("stopped", &name))
}

async fn shutdown_vm(State(manager): State<LibvirtManager>, Path(name): Path<String>) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    tokio::task::spawn_blocking(move || manager.with_conn(|conn| domain::shutdown_vm(conn, &name2)))
        .await
        .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
        ?;
    log_audit("shutdown", &name, "ok");
    Ok(ok_json("shutting down", &name))
}

async fn reboot_vm(State(manager): State<LibvirtManager>, Path(name): Path<String>) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    tokio::task::spawn_blocking(move || manager.with_conn(|conn| domain::reboot_vm(conn, &name2)))
        .await
        .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
        ?;
    Ok(ok_json("rebooting", &name))
}

async fn pause_vm(State(manager): State<LibvirtManager>, Path(name): Path<String>) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    tokio::task::spawn_blocking(move || manager.with_conn(|conn| domain::pause_vm(conn, &name2)))
        .await
        .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
        ?;
    Ok(ok_json("paused", &name))
}

async fn resume_vm(State(manager): State<LibvirtManager>, Path(name): Path<String>) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    tokio::task::spawn_blocking(move || manager.with_conn(|conn| domain::resume_vm(conn, &name2)))
        .await
        .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
        ?;
    Ok(ok_json("resumed", &name))
}

#[derive(Deserialize, Default)]
struct DeleteVmQuery {
    #[serde(default)]
    undefine_managed_save: bool,
    #[serde(default)]
    undefine_snapshots_metadata: bool,
    #[serde(default)]
    undefine_nvram: bool,
    #[serde(default)]
    undefine_keep_nvram: bool,
    #[serde(default)]
    undefine_checkpoints_metadata: bool,
    #[serde(default)]
    undefine_tpm: bool,
    #[serde(default)]
    undefine_keep_tpm: bool,
}

async fn delete_vm_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Query(q): Query<DeleteVmQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let opts = UndefineOptions {
        managed_save: q.undefine_managed_save,
        snapshots_metadata: q.undefine_snapshots_metadata,
        nvram: q.undefine_nvram,
        keep_nvram: q.undefine_keep_nvram,
        checkpoints_metadata: q.undefine_checkpoints_metadata,
        tpm: q.undefine_tpm,
        keep_tpm: q.undefine_keep_tpm,
    };
    let name2 = name.clone();
    tokio::task::spawn_blocking(move || manager.with_conn(|conn| domain::delete_vm_with_options(conn, &name2, &opts)))
        .await
        .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
        ?;
    log_audit("delete", &name, "ok");
    Ok(ok_json("deleted", &name))
}

#[derive(Deserialize)]
struct BlockCommitBody {
    disk: String,
    #[serde(default)]
    base: Option<String>,
    #[serde(default)]
    top: Option<String>,
    #[serde(default)]
    bandwidth: u64,
    #[serde(default)]
    shallow: bool,
    #[serde(default)]
    delete: bool,
    #[serde(default)]
    active: bool,
    #[serde(default)]
    relative: bool,
    #[serde(default)]
    bandwidth_bytes: bool,
}

async fn block_commit_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Json(req): Json<BlockCommitBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let flags = block_jobs::block_commit_flags(
        req.shallow,
        req.delete,
        req.active,
        req.relative,
        req.bandwidth_bytes,
    );
    let disk = req.disk.clone();
    let base = req.base.clone();
    let top = req.top.clone();
    let bandwidth = req.bandwidth;
    let name2 = name.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| {
            block_jobs::block_commit(
                conn,
                &name2,
                &disk,
                base.as_deref(),
                top.as_deref(),
                bandwidth,
                flags,
            )
        })
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
    ?;
    Ok(Json(serde_json::json!({ "status": "block_commit_started", "name": name })))
}

#[derive(Deserialize)]
struct BlockPullBody {
    disk: String,
    #[serde(default)]
    bandwidth: u64,
    #[serde(default)]
    bandwidth_bytes: bool,
}

async fn block_pull_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Json(req): Json<BlockPullBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let flags = block_jobs::block_pull_flags(req.bandwidth_bytes);
    let disk = req.disk.clone();
    let bandwidth = req.bandwidth;
    let name2 = name.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| block_jobs::block_pull(conn, &name2, &disk, bandwidth, flags))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
    ?;
    Ok(Json(serde_json::json!({ "status": "block_pull_started", "name": name })))
}

#[derive(Deserialize)]
struct BlockJobQuery {
    disk: String,
    #[serde(default)]
    bandwidth_bytes: bool,
}

async fn block_job_info_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Query(q): Query<BlockJobQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let disk = q.disk.clone();
    let flags = block_jobs::block_job_info_flags(q.bandwidth_bytes);
    let name2 = name.clone();
    let result = tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| block_jobs::block_job_info(conn, &name2, &disk, flags))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?;
    Ok(Json(serde_json::json!({ "name": name, "job": result? })))
}

#[derive(Deserialize)]
struct BlockJobAbortBody {
    disk: String,
    #[serde(default)]
    r#async: bool,
    #[serde(default)]
    pivot: bool,
}

async fn block_job_abort_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Json(req): Json<BlockJobAbortBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let flags = block_jobs::block_job_abort_flags(req.r#async, req.pivot);
    let disk = req.disk.clone();
    let name2 = name.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| block_jobs::block_job_abort(conn, &name2, &disk, flags))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
    ?;
    Ok(Json(serde_json::json!({ "status": "block_job_abort", "name": name })))
}

async fn set_memtune_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Json(req): Json<MemTuneInfo>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    let req2 = req.clone();
    tokio::task::spawn_blocking(move || manager.with_conn(|conn| resize::set_memtune_kb(conn, &name2, &req2)))
        .await
        .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
        ?;
    Ok(Json(serde_json::json!({ "status": "memtune_updated", "name": name })))
}

#[derive(Deserialize)]
struct SchedulerTuneBody {
    #[serde(default)]
    cpu_shares: Option<u64>,
    #[serde(default)]
    vcpu_period: Option<u64>,
    #[serde(default)]
    vcpu_quota: Option<i64>,
}

async fn set_scheduler_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Json(req): Json<SchedulerTuneBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    let cpu_shares = req.cpu_shares;
    let vcpu_period = req.vcpu_period;
    let vcpu_quota = req.vcpu_quota;
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| {
            resize::set_cpu_scheduler_partial(conn, &name2, cpu_shares, vcpu_period, vcpu_quota)
        })
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
    ?;
    Ok(Json(serde_json::json!({ "status": "scheduler_updated", "name": name })))
}

#[derive(Deserialize)]
struct PinVcpuBody {
    cpus: Vec<bool>,
}

async fn pin_vcpu_handler(
    State(manager): State<LibvirtManager>,
    Path((name, vcpu)): Path<(String, u32)>,
    Json(req): Json<PinVcpuBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    let cpus = req.cpus.clone();
    tokio::task::spawn_blocking(move || manager.with_conn(|conn| resize::pin_vcpu(conn, &name2, vcpu, &cpus)))
        .await
        .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
        ?;
    Ok(Json(serde_json::json!({ "status": "vcpu_pinned", "name": name, "vcpu": vcpu })))
}

async fn set_autostart(
    State(manager): State<LibvirtManager>,
    Path((name, enabled)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, AppError> {
    let autostart = enabled == "true" || enabled == "1";
    let name2 = name.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| domain::set_autostart(conn, &name2, autostart))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
    ?;
    Ok(Json(serde_json::json!({ "status": "ok", "name": name, "autostart": autostart })))
}

async fn clone_vm_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Json(req): Json<CloneVmRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    let new_name = req.new_name.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| clone::clone_vm(conn, &name2, &new_name))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
    ?;
    log_audit("clone", &format!("{name} -> {}", req.new_name), "ok");
    Ok(Json(serde_json::json!({ "status": "cloned", "source": name, "clone": req.new_name })))
}

async fn create_vm_handler(
    State(manager): State<LibvirtManager>,
    Json(req): Json<CreateVmRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    virtspawn_core::validate::validate_create_backend_override(&req.create_backend)?;
    virtspawn_core::validate::validate_template_disk_mode(&req.template_disk_mode)?;
    virtspawn_core::validate::validate_create_vm_disk_image_builders(&req)?;
    let name = req.name.clone();
    let cfg = VirtspawnConfig::load();
    let backend = match req.create_backend.trim() {
        "virt_install" => VmCreateBackend::VirtInstall,
        "libvirt_xml" => VmCreateBackend::LibvirtXml,
        _ => cfg.libvirt.create_backend,
    };
    let libvirt_uri = cfg.libvirt.uri.clone();
    let libvirt_cfg = cfg.libvirt.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| create::create_vm(conn, &req, backend, &libvirt_uri, &libvirt_cfg))
    })
        .await
        .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
        ?;
    log_audit("create", &name, "ok");
    Ok(ok_json("created", &name))
}

async fn set_vcpus(
    State(manager): State<LibvirtManager>,
    Path((name, count)): Path<(String, u32)>,
) -> Result<Json<serde_json::Value>, AppError> {
    virtspawn_core::validate::validate_vcpus(count)?;
    let name2 = name.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| resize::set_vcpus(conn, &name2, count))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
    ?;
    Ok(Json(serde_json::json!({ "status": "ok", "name": name, "vcpus": count })))
}

async fn set_memory(
    State(manager): State<LibvirtManager>,
    Path((name, mb)): Path<(String, u64)>,
) -> Result<Json<serde_json::Value>, AppError> {
    virtspawn_core::validate::validate_memory_mb(mb)?;
    let name2 = name.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| resize::set_memory(conn, &name2, mb))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
    ?;
    Ok(Json(serde_json::json!({ "status": "ok", "name": name, "memory_mb": mb })))
}

async fn attach_disk_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Json(req): Json<AttachDiskRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    let target = req.target.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| device::attach_disk(conn, &name2, &req))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
    ?;
    Ok(Json(serde_json::json!({ "status": "attached", "name": name, "target": target })))
}

async fn detach_disk_handler(
    State(manager): State<LibvirtManager>,
    Path((name, target)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    let target2 = target.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| device::detach_disk(conn, &name2, &target2))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
    ?;
    Ok(Json(serde_json::json!({ "status": "detached", "name": name, "target": target })))
}

async fn rename_vm_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Json(req): Json<RenameVmRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    let new_name = req.new_name.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| domain::rename_vm(conn, &name2, &new_name))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
    ?;
    Ok(Json(serde_json::json!({ "status": "renamed", "old_name": name, "new_name": req.new_name })))
}

#[derive(serde::Deserialize)]
struct ResizeDiskRequest { size_gb: u64 }

async fn resize_disk_handler(
    State(manager): State<LibvirtManager>,
    Path((name, target)): Path<(String, String)>,
    Json(req): Json<ResizeDiskRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    let target2 = target.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| device::resize_block_device(conn, &name2, &target2, req.size_gb))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
    ?;
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
    let name2 = name.clone();
    let network = req.network.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| device::attach_interface(conn, &name2, &req.network, &req.model))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
    ?;
    Ok(Json(serde_json::json!({ "status": "attached", "name": name, "network": network })))
}

async fn detach_interface_handler(
    State(manager): State<LibvirtManager>,
    Path((name, mac)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    let mac2 = mac.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| device::detach_interface(conn, &name2, &mac2))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
    ?;
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

async fn get_vm_logs(
    Path(name): Path<String>,
    Query(params): Query<HashMap<String, String>>,
    State(_manager): State<LibvirtManager>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Validate name has no path separators
    if name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err(LibvirtError::Invalid("Invalid VM name".into()).into());
    }
    let lines: usize = params
        .get("lines")
        .and_then(|l| l.parse().ok())
        .unwrap_or(500)
        .min(5000);
    let log_path = format!("/var/log/libvirt/qemu/{}.log", name);
    let content = match std::fs::read_to_string(&log_path) {
        Ok(c) => {
            let all_lines: Vec<&str> = c.lines().collect();
            let start = all_lines.len().saturating_sub(lines);
            all_lines[start..].join("\n")
        }
        Err(_) => String::new(),
    };
    Ok(Json(serde_json::json!({
        "vm_name": name,
        "log_path": log_path,
        "content": content,
    })))
}

async fn get_cputune_handler(
    Path(name): Path<String>,
    State(manager): State<LibvirtManager>,
) -> Result<Json<CpuTuneInfo>, AppError> {
    let result = tokio::task::spawn_blocking(move || {
        manager.with_conn(|c| resize::get_cputune(c, &name))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?;
    Ok(Json(result?))
}

async fn get_memtune_handler(
    Path(name): Path<String>,
    State(manager): State<LibvirtManager>,
) -> Result<Json<MemTuneInfo>, AppError> {
    let result = tokio::task::spawn_blocking(move || {
        manager.with_conn(|c| resize::get_memtune(c, &name))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?;
    Ok(Json(result?))
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
        .route("/vms/{name}/logs", get(get_vm_logs))
        .route("/vms/{name}/cputune", get(get_cputune_handler))
        .route("/vms/{name}/memtune", get(get_memtune_handler).post(set_memtune_handler))
        .route("/vms/{name}/scheduler", post(set_scheduler_handler))
        .route("/vms/{name}/vcpu/{vcpu}/pin", post(pin_vcpu_handler))
        .route("/vms/{name}/block/commit", post(block_commit_handler))
        .route("/vms/{name}/block/pull", post(block_pull_handler))
        .route("/vms/{name}/block/job", get(block_job_info_handler))
        .route("/vms/{name}/block/job/abort", post(block_job_abort_handler))
}
