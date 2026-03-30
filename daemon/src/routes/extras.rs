use axum::extract::{Path, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use virtspawn_core::libvirt::extras;
use virtspawn_core::{audit, LibvirtManager};

use crate::error::AppError;

// ── ISO / Disk Browser ─────────────────────────────────────────────

async fn list_isos(
    State(_m): State<LibvirtManager>,
) -> Result<Json<serde_json::Value>, AppError> {
    let files = extras::list_iso_files();
    Ok(Json(serde_json::json!(files)))
}

async fn list_disk_images(
    State(_m): State<LibvirtManager>,
) -> Result<Json<serde_json::Value>, AppError> {
    let files = extras::list_disk_images();
    Ok(Json(serde_json::json!(files)))
}

// ── USB Passthrough ────────────────────────────────────────────────

async fn list_usb(
    State(_m): State<LibvirtManager>,
) -> Result<Json<serde_json::Value>, AppError> {
    let devices = extras::list_usb_devices()?;
    Ok(Json(serde_json::json!(devices)))
}

#[derive(Deserialize)]
struct UsbRequest { vendor_id: String, product_id: String }

async fn attach_usb_handler(
    State(m): State<LibvirtManager>,
    Path(name): Path<String>,
    Json(req): Json<UsbRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    m.with_conn(|conn| extras::attach_usb(conn, &name, &req.vendor_id, &req.product_id))?;
    Ok(Json(serde_json::json!({ "status": "attached", "name": name })))
}

async fn detach_usb_handler(
    State(m): State<LibvirtManager>,
    Path(name): Path<String>,
    Json(req): Json<UsbRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    m.with_conn(|conn| extras::detach_usb(conn, &name, &req.vendor_id, &req.product_id))?;
    Ok(Json(serde_json::json!({ "status": "detached", "name": name })))
}

// ── Cloud-init ─────────────────────────────────────────────────────

#[derive(Deserialize)]
struct CloudInitRequest {
    hostname: String,
    #[serde(default)]
    username: String,
    #[serde(default)]
    password: String,
    #[serde(default)]
    ssh_key: String,
    #[serde(default)]
    output_path: String,
}

async fn generate_cloud_init(
    State(_m): State<LibvirtManager>,
    Json(req): Json<CloudInitRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let path = extras::generate_cloud_init_iso(&req.output_path, &req.hostname, &req.username, &req.password, &req.ssh_key)?;
    Ok(Json(serde_json::json!({ "status": "created", "path": path })))
}

// ── VM Import ──────────────────────────────────────────────────────

#[derive(Deserialize)]
struct ImportRequest { source: String, dest_name: String }

async fn import_disk(
    State(_m): State<LibvirtManager>,
    Json(req): Json<ImportRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let path = extras::import_disk_image(&req.source, &req.dest_name)?;
    Ok(Json(serde_json::json!({ "status": "imported", "path": path })))
}

// ── Live Resize ────────────────────────────────────────────────────

async fn live_vcpus_handler(
    State(m): State<LibvirtManager>,
    Path((name, count)): Path<(String, u32)>,
) -> Result<Json<serde_json::Value>, AppError> {
    m.with_conn(|conn| extras::live_set_vcpus(conn, &name, count))?;
    Ok(Json(serde_json::json!({ "status": "ok", "name": name, "vcpus": count, "live": true })))
}

async fn live_memory_handler(
    State(m): State<LibvirtManager>,
    Path((name, mb)): Path<(String, u64)>,
) -> Result<Json<serde_json::Value>, AppError> {
    m.with_conn(|conn| extras::live_set_memory(conn, &name, mb))?;
    Ok(Json(serde_json::json!({ "status": "ok", "name": name, "memory_mb": mb, "live": true })))
}

// ── Audit Log ──────────────────────────────────────────────────────

async fn get_audit_log(
    State(_m): State<LibvirtManager>,
) -> Result<Json<serde_json::Value>, AppError> {
    let events = audit::load_audit_events(500);
    Ok(Json(serde_json::json!(events)))
}

// ── Router ─────────────────────────────────────────────────────────

pub fn extras_routes() -> Router<LibvirtManager> {
    Router::new()
        // Browser
        .route("/browse/isos", get(list_isos))
        .route("/browse/disks", get(list_disk_images))
        // USB
        .route("/host/usb", get(list_usb))
        .route("/vms/{name}/usb/attach", post(attach_usb_handler))
        .route("/vms/{name}/usb/detach", post(detach_usb_handler))
        // Cloud-init
        .route("/cloud-init", post(generate_cloud_init))
        // Import
        .route("/import/disk", post(import_disk))
        // Live resize
        .route("/vms/{name}/live/vcpus/{count}", post(live_vcpus_handler))
        .route("/vms/{name}/live/memory/{mb}", post(live_memory_handler))
        // Audit
        .route("/audit", get(get_audit_log))
}
