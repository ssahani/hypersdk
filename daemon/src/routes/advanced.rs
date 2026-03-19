use axum::extract::{Path, State};
use axum::routing::{delete, get, post};
use axum::{Json, Router};

use virtspawn_core::libvirt::{
    boot, capabilities, cdrom, guest_agent, migrate, node_device, nwfilter,
    save_restore, secret, storage,
};
use virtspawn_core::LibvirtManager;

use crate::error::AppError;

// ── Guest Agent ─────────────────────────────────────────────────────

async fn get_interfaces(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ifaces = manager.with_conn(|conn| guest_agent::get_guest_interfaces(conn, &name))?;
    Ok(Json(serde_json::json!(ifaces)))
}

async fn get_hostname(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let hostname = manager.with_conn(|conn| guest_agent::get_guest_hostname(conn, &name))?;
    Ok(Json(serde_json::json!({ "hostname": hostname })))
}

// ── CD-ROM ──────────────────────────────────────────────────────────

#[derive(serde::Deserialize)]
struct CdromRequest {
    iso_path: String,
    #[serde(default = "default_cdrom_target")]
    target: String,
}

fn default_cdrom_target() -> String { "sda".to_string() }

async fn insert_cdrom_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Json(req): Json<CdromRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| cdrom::insert_cdrom(conn, &name, &req.iso_path, &req.target))?;
    Ok(Json(serde_json::json!({ "status": "inserted", "name": name, "target": req.target })))
}

async fn eject_cdrom_handler(
    State(manager): State<LibvirtManager>,
    Path((name, target)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| cdrom::eject_cdrom(conn, &name, &target))?;
    Ok(Json(serde_json::json!({ "status": "ejected", "name": name, "target": target })))
}

// ── Save/Restore ────────────────────────────────────────────────────

async fn managed_save_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| save_restore::managed_save(conn, &name))?;
    Ok(Json(serde_json::json!({ "status": "saved", "name": name })))
}

async fn managed_save_remove_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| save_restore::managed_save_remove(conn, &name))?;
    Ok(Json(serde_json::json!({ "status": "removed", "name": name })))
}

async fn has_managed_save_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let has_save = manager.with_conn(|conn| save_restore::has_managed_save(conn, &name))?;
    Ok(Json(serde_json::json!({ "name": name, "has_managed_save": has_save })))
}

// ── Boot ────────────────────────────────────────────────────────────

async fn get_boot_config_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let config = manager.with_conn(|conn| boot::get_boot_config(conn, &name))?;
    Ok(Json(serde_json::json!(config)))
}

#[derive(serde::Deserialize)]
struct BootOrderRequest { devices: Vec<String> }

async fn set_boot_order_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Json(req): Json<BootOrderRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| boot::set_boot_order(conn, &name, &req.devices))?;
    Ok(Json(serde_json::json!({ "status": "ok", "name": name, "boot_devices": req.devices })))
}

// ── Migration ───────────────────────────────────────────────────────

#[derive(serde::Deserialize)]
struct MigrateRequest {
    dest_uri: String,
    #[serde(default)]
    live: bool,
}

async fn migrate_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Json(req): Json<MigrateRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| migrate::migrate_vm_uri(conn, &name, &req.dest_uri, req.live))?;
    Ok(Json(serde_json::json!({ "status": "migrated", "name": name, "destination": req.dest_uri })))
}

// ── Capabilities ────────────────────────────────────────────────────

async fn get_capabilities_handler(
    State(manager): State<LibvirtManager>,
) -> Result<Json<serde_json::Value>, AppError> {
    let caps = manager.with_conn(capabilities::get_capabilities)?;
    Ok(Json(serde_json::json!(caps)))
}

async fn get_sysinfo_handler(
    State(manager): State<LibvirtManager>,
) -> Result<String, AppError> {
    let xml = manager.with_conn(capabilities::get_sysinfo)?;
    Ok(xml)
}

// ── Node Devices ────────────────────────────────────────────────────

async fn list_node_devices_handler(
    State(manager): State<LibvirtManager>,
) -> Result<Json<serde_json::Value>, AppError> {
    let devices = manager.with_conn(|conn| node_device::list_node_devices(conn, None))?;
    Ok(Json(serde_json::json!(devices)))
}

async fn get_node_device_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<String, AppError> {
    let xml = manager.with_conn(|conn| node_device::get_node_device_xml(conn, &name))?;
    Ok(xml)
}

// ── Network Filters ─────────────────────────────────────────────────

async fn list_nwfilters_handler(
    State(manager): State<LibvirtManager>,
) -> Result<Json<serde_json::Value>, AppError> {
    let filters = manager.with_conn(nwfilter::list_nwfilters)?;
    Ok(Json(serde_json::json!(filters)))
}

async fn get_nwfilter_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<String, AppError> {
    let xml = manager.with_conn(|conn| nwfilter::get_nwfilter_xml(conn, &name))?;
    Ok(xml)
}

async fn delete_nwfilter_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| nwfilter::delete_nwfilter(conn, &name))?;
    Ok(Json(serde_json::json!({ "status": "deleted", "name": name })))
}

// ── Secrets ─────────────────────────────────────────────────────────

async fn list_secrets_handler(
    State(manager): State<LibvirtManager>,
) -> Result<Json<serde_json::Value>, AppError> {
    let secrets = manager.with_conn(secret::list_secrets)?;
    Ok(Json(serde_json::json!(secrets)))
}

async fn delete_secret_handler(
    State(manager): State<LibvirtManager>,
    Path(uuid): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| secret::delete_secret(conn, &uuid))?;
    Ok(Json(serde_json::json!({ "status": "deleted", "uuid": uuid })))
}

// ── Storage Pool Create/Delete ──────────────────────────────────────

#[derive(serde::Deserialize)]
struct CreatePoolRequest {
    name: String,
    #[serde(default = "default_pool_type")]
    pool_type: String,
    target_path: String,
}

fn default_pool_type() -> String { "dir".to_string() }

async fn create_pool_handler(
    State(manager): State<LibvirtManager>,
    Json(req): Json<CreatePoolRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| storage::create_pool(conn, &req.name, &req.pool_type, &req.target_path))?;
    Ok(Json(serde_json::json!({ "status": "created", "name": req.name })))
}

async fn delete_pool_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| storage::delete_pool(conn, &name))?;
    Ok(Json(serde_json::json!({ "status": "deleted", "name": name })))
}

async fn get_pool_xml_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<String, AppError> {
    let xml = manager.with_conn(|conn| storage::get_pool_xml(conn, &name))?;
    Ok(xml)
}

// ── Volume Resize/Clone ─────────────────────────────────────────────

#[derive(serde::Deserialize)]
struct ResizeVolumeRequest { capacity_gb: u64 }

async fn resize_volume_handler(
    State(manager): State<LibvirtManager>,
    Path((pool, vol)): Path<(String, String)>,
    Json(req): Json<ResizeVolumeRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| storage::resize_volume(conn, &pool, &vol, req.capacity_gb))?;
    Ok(Json(serde_json::json!({ "status": "resized", "pool": pool, "volume": vol, "capacity_gb": req.capacity_gb })))
}

#[derive(serde::Deserialize)]
struct CloneVolumeRequest { new_name: String }

async fn clone_volume_handler(
    State(manager): State<LibvirtManager>,
    Path((pool, vol)): Path<(String, String)>,
    Json(req): Json<CloneVolumeRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| storage::clone_volume(conn, &pool, &vol, &req.new_name))?;
    Ok(Json(serde_json::json!({ "status": "cloned", "pool": pool, "source": vol, "clone": req.new_name })))
}

// ── CPU Pinning ─────────────────────────────────────────────────────

async fn set_memory_balloon_handler(
    State(manager): State<LibvirtManager>,
    Path((name, mb)): Path<(String, u64)>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| virtspawn_core::libvirt::resize::set_memory_balloon(conn, &name, mb))?;
    Ok(Json(serde_json::json!({ "status": "ok", "name": name, "memory_mb": mb })))
}

// ── Routes ──────────────────────────────────────────────────────────

pub fn advanced_routes() -> Router<LibvirtManager> {
    Router::new()
        // Guest agent
        .route("/vms/{name}/interfaces", get(get_interfaces))
        .route("/vms/{name}/hostname", get(get_hostname))
        // CD-ROM
        .route("/vms/{name}/cdrom/insert", post(insert_cdrom_handler))
        .route("/vms/{name}/cdrom/eject/{target}", post(eject_cdrom_handler))
        // Save/Restore
        .route("/vms/{name}/managed-save", post(managed_save_handler))
        .route("/vms/{name}/managed-save", delete(managed_save_remove_handler))
        .route("/vms/{name}/managed-save/status", get(has_managed_save_handler))
        // Boot
        .route("/vms/{name}/boot", get(get_boot_config_handler))
        .route("/vms/{name}/boot", post(set_boot_order_handler))
        // Migration
        .route("/vms/{name}/migrate", post(migrate_handler))
        // Memory balloon
        .route("/vms/{name}/balloon/{mb}", post(set_memory_balloon_handler))
        // Capabilities
        .route("/capabilities", get(get_capabilities_handler))
        .route("/sysinfo", get(get_sysinfo_handler))
        // Node devices
        .route("/devices", get(list_node_devices_handler))
        .route("/devices/{name}", get(get_node_device_handler))
        // Network filters
        .route("/nwfilters", get(list_nwfilters_handler))
        .route("/nwfilters/{name}", get(get_nwfilter_handler))
        .route("/nwfilters/{name}", delete(delete_nwfilter_handler))
        // Secrets
        .route("/secrets", get(list_secrets_handler))
        .route("/secrets/{uuid}", delete(delete_secret_handler))
        // Storage pool management
        .route("/storage/pools", post(create_pool_handler))
        .route("/storage/pools/{name}", delete(delete_pool_handler))
        .route("/storage/pools/{name}/xml", get(get_pool_xml_handler))
        // Volume resize/clone
        .route("/storage/pools/{pool}/volumes/{vol}/resize", post(resize_volume_handler))
        .route("/storage/pools/{pool}/volumes/{vol}/clone", post(clone_volume_handler))
}
