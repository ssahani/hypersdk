use axum::extract::{Path, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use virtspawn_core::libvirt::extras;
use virtspawn_core::{audit, AuditEvent, LibvirtError, LibvirtManager};

use crate::error::AppError;

fn log_audit(action: &str, target: &str, result: &str) {
    let event = AuditEvent {
        timestamp: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        action: action.to_string(),
        target: target.to_string(),
        result: result.to_string(),
    };
    audit::write_audit_event(&event);
}

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
    let name2 = name.clone();
    tokio::task::spawn_blocking(move || {
        m.with_conn(|conn| extras::attach_usb(conn, &name2, &req.vendor_id, &req.product_id))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
    ?;
    Ok(Json(serde_json::json!({ "status": "attached", "name": name })))
}

async fn detach_usb_handler(
    State(m): State<LibvirtManager>,
    Path(name): Path<String>,
    Json(req): Json<UsbRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    tokio::task::spawn_blocking(move || {
        m.with_conn(|conn| extras::detach_usb(conn, &name2, &req.vendor_id, &req.product_id))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
    ?;
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
    let name2 = name.clone();
    tokio::task::spawn_blocking(move || {
        m.with_conn(|conn| extras::live_set_vcpus(conn, &name2, count))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
    ?;
    Ok(Json(serde_json::json!({ "status": "ok", "name": name, "vcpus": count, "live": true })))
}

async fn live_memory_handler(
    State(m): State<LibvirtManager>,
    Path((name, mb)): Path<(String, u64)>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    tokio::task::spawn_blocking(move || {
        m.with_conn(|conn| extras::live_set_memory(conn, &name2, mb))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
    ?;
    Ok(Json(serde_json::json!({ "status": "ok", "name": name, "memory_mb": mb, "live": true })))
}

// ── DHCP Leases ────────────────────────────────────────────────────

async fn list_dhcp_leases(
    State(m): State<LibvirtManager>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = tokio::task::spawn_blocking(move || m.with_conn(extras::list_dhcp_leases))
        .await
        .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?;
    Ok(Json(serde_json::json!(result?)))
}

// ── Host System Stats ──────────────────────────────────────────────

async fn get_host_stats(
    State(_m): State<LibvirtManager>,
) -> Result<Json<serde_json::Value>, AppError> {
    let stats = extras::get_host_stats();
    Ok(Json(serde_json::json!(stats)))
}

// ── Save VM as Template ────────────────────────────────────────────

#[derive(Deserialize)]
struct SaveTemplateRequest { template_name: String }

async fn save_template_handler(
    State(m): State<LibvirtManager>,
    Path(name): Path<String>,
    Json(req): Json<SaveTemplateRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    let template_name = req.template_name.clone();
    tokio::task::spawn_blocking(move || {
        m.with_conn(|conn| extras::save_vm_as_template(conn, &name2, &template_name))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
    ?;
    Ok(Json(serde_json::json!({ "status": "saved", "name": name, "template": req.template_name })))
}

// ── Audit Log ──────────────────────────────────────────────────────

async fn get_audit_log(
    State(_m): State<LibvirtManager>,
) -> Result<Json<serde_json::Value>, AppError> {
    let events = audit::load_audit_events(500);
    Ok(Json(serde_json::json!(events)))
}

// ── Tags (all tags summary) ──────────────────────────────────────

async fn get_all_tags_handler(
    State(_m): State<LibvirtManager>,
) -> Result<Json<serde_json::Value>, AppError> {
    let map = extras::load_tags();
    let mut counts: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    for tags in map.values() {
        for tag in tags {
            *counts.entry(tag.clone()).or_insert(0) += 1;
        }
    }
    Ok(Json(serde_json::json!(counts)))
}

// ── PCI Passthrough ───────────────────────────────────────────────

async fn list_pci_handler(
    State(_m): State<LibvirtManager>,
) -> Result<Json<serde_json::Value>, AppError> {
    let devices = extras::list_pci_devices()?;
    Ok(Json(serde_json::json!(devices)))
}

// ── IOMMU Groups ─────────────────────────────────────────────────

async fn list_iommu_groups_handler(
    State(_m): State<LibvirtManager>,
) -> Result<Json<serde_json::Value>, AppError> {
    let groups = extras::list_iommu_groups()?;
    Ok(Json(serde_json::json!(groups)))
}

// ── Systemd Services ──────────────────────────────────────────────

async fn list_services_handler(
    State(_m): State<LibvirtManager>,
) -> Result<Json<serde_json::Value>, AppError> {
    let services = extras::list_services()?;
    Ok(Json(serde_json::json!(services)))
}

async fn service_action_handler(
    State(_m): State<LibvirtManager>,
    Path((name, action)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, AppError> {
    log_audit("service_action", &format!("{action} {name}"), "");
    extras::service_action(&name, &action)?;
    Ok(Json(serde_json::json!({ "status": "ok", "service": name, "action": action })))
}

// ── System Logs ───────────────────────────────────────────────────

async fn get_logs_handler(
    State(_m): State<LibvirtManager>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let lines: u32 = params.get("lines").and_then(|v| v.parse().ok()).unwrap_or(100);
    let priority = params.get("priority").map(|s| s.as_str());
    let unit = params.get("unit").map(|s| s.as_str());
    let entries = extras::get_journal_logs(lines, priority, unit)?;
    Ok(Json(serde_json::json!(entries)))
}

// ── Host Shutdown/Reboot ──────────────────────────────────────────

async fn host_shutdown_handler(
    State(_m): State<LibvirtManager>,
) -> Result<Json<serde_json::Value>, AppError> {
    log_audit("host_shutdown", "host", "");
    extras::host_shutdown()?;
    Ok(Json(serde_json::json!({ "status": "shutting_down" })))
}

async fn host_reboot_handler(
    State(_m): State<LibvirtManager>,
) -> Result<Json<serde_json::Value>, AppError> {
    log_audit("host_reboot", "host", "");
    extras::host_reboot()?;
    Ok(Json(serde_json::json!({ "status": "rebooting" })))
}

// ── Host System Info ──────────────────────────────────────────────

async fn get_system_info_handler(
    State(_m): State<LibvirtManager>,
) -> Result<Json<serde_json::Value>, AppError> {
    let info = extras::get_system_info()?;
    Ok(Json(serde_json::json!(info)))
}

#[derive(Deserialize)]
struct SetHostnameRequest { hostname: String }

async fn set_hostname_handler(
    State(_m): State<LibvirtManager>,
    Json(req): Json<SetHostnameRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    log_audit("set_hostname", &req.hostname, "");
    extras::set_hostname(&req.hostname)?;
    Ok(Json(serde_json::json!({ "status": "ok", "hostname": req.hostname })))
}

#[derive(Deserialize)]
struct SetTimezoneRequest { timezone: String }

async fn set_timezone_handler(
    State(_m): State<LibvirtManager>,
    Json(req): Json<SetTimezoneRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    log_audit("set_timezone", &req.timezone, "");
    extras::set_timezone(&req.timezone)?;
    Ok(Json(serde_json::json!({ "status": "ok", "timezone": req.timezone })))
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
        // Tags (per-VM tags are in vms.rs)
        .route("/tags", get(get_all_tags_handler))
        // PCI
        .route("/host/pci", get(list_pci_handler))
        // IOMMU
        .route("/host/iommu-groups", get(list_iommu_groups_handler))
        // Host stats + DHCP
        .route("/host/stats", get(get_host_stats))
        .route("/dhcp-leases", get(list_dhcp_leases))
        // Save as template
        .route("/vms/{name}/save-template", post(save_template_handler))
        // Systemd services
        .route("/services", get(list_services_handler))
        .route("/services/{name}/{action}", post(service_action_handler))
        // System logs
        .route("/logs", get(get_logs_handler))
        // Host shutdown/reboot
        .route("/host/shutdown", post(host_shutdown_handler))
        .route("/host/reboot", post(host_reboot_handler))
        // Host system info
        .route("/host/system-info", get(get_system_info_handler))
        .route("/host/hostname", post(set_hostname_handler))
        .route("/host/timezone", post(set_timezone_handler))
}
