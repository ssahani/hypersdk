use axum::extract::{Extension, Path, Query, State};
use axum::routing::{delete, get, post};
use axum::{Json, Router};

use std::collections::HashMap;

use machina_core::libvirt::guest_agent::GuestIpAddress;
use machina_core::libvirt::{
    boot, capabilities, cdrom, domain, domain_job, emulator, extras, filesystem, guest_agent,
    host_cpu, hostdev_pci, migrate, net_xml, network, node_device, numa_tune, nwfilter,
    save_restore, secret, storage,
};
use machina_core::{LibvirtError, LibvirtManager};

use crate::auth::{require_usb_pci, RequestActor};
use crate::conn_query::{spawn_libvirt, ConnQuery};
use crate::error::{AppError, Xml};

fn enrich_dns_ptr(mut addrs: Vec<GuestIpAddress>) -> Vec<GuestIpAddress> {
    use std::net::IpAddr;
    for a in &mut addrs {
        if a.ip_type != "ipv4" {
            continue;
        }
        let Ok(ip) = a.address.parse::<IpAddr>() else {
            continue;
        };
        if ip.is_loopback() {
            continue;
        }
        if let IpAddr::V4(v4) = ip {
            if v4.is_link_local() || v4.is_broadcast() {
                continue;
            }
        }
        match dns_lookup::lookup_addr(&ip) {
            Ok(name) if name != a.address => a.dns_ptr = Some(name),
            _ => {}
        }
    }
    addrs
}

// ── Guest Agent ─────────────────────────────────────────────────────

async fn get_interfaces(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Query(conn_q): Query<ConnQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    let (addrs, net_gw): (Vec<GuestIpAddress>, HashMap<String, String>) =
        spawn_libvirt(manager, conn_q, move |conn| {
            let mut addrs = guest_agent::get_guest_interfaces(conn, &name2)?;
            let leases = extras::list_dhcp_leases(conn).unwrap_or_default();
            addrs = guest_agent::enrich_with_dhcp_leases(addrs, &leases);
            let mut gateways: HashMap<String, String> = HashMap::new();
            if let Ok(dom_xml) = domain::get_vm_xml(conn, &name2) {
                for n in net_xml::network_names_from_domain_xml(&dom_xml) {
                    if gateways.contains_key(&n) {
                        continue;
                    }
                    if let Ok(nxml) = network::get_network_xml(conn, &n) {
                        if let Some(gw) = net_xml::ipv4_gateway_from_network_xml(&nxml) {
                            gateways.insert(n, gw);
                        }
                    }
                }
            }
            Ok((addrs, gateways))
        })
        .await?;

    let addrs = tokio::task::spawn_blocking(move || enrich_dns_ptr(addrs))
        .await
        .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?;

    Ok(Json(serde_json::json!({
        "addresses": addrs,
        "queried_at": chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true),
        "network_gateways": net_gw,
    })))
}

async fn get_hostname(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Query(conn_q): Query<ConnQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    let h = spawn_libvirt(manager, conn_q, move |conn| {
        guest_agent::get_guest_hostname(conn, &name2)
    })
    .await?;
    Ok(Json(serde_json::json!({ "hostname": h })))
}

// ── CD-ROM ──────────────────────────────────────────────────────────

#[derive(serde::Deserialize)]
struct CdromRequest {
    iso_path: String,
    #[serde(default = "default_cdrom_target")]
    target: String,
}

fn default_cdrom_target() -> String {
    "sda".to_string()
}

async fn insert_cdrom_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Json(req): Json<CdromRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    let target = req.target.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| cdrom::insert_cdrom(conn, &name2, &req.iso_path, &req.target))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))??;
    Ok(Json(
        serde_json::json!({ "status": "inserted", "name": name, "target": target }),
    ))
}

async fn eject_cdrom_handler(
    State(manager): State<LibvirtManager>,
    Path((name, target)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    let target2 = target.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| cdrom::eject_cdrom(conn, &name2, &target2))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))??;
    Ok(Json(
        serde_json::json!({ "status": "ejected", "name": name, "target": target }),
    ))
}

// ── Shared directories (virtiofs) ───────────────────────────────────

#[derive(serde::Deserialize)]
struct ShareRequest {
    source_dir: String,
    mount_tag: String,
    #[serde(default)]
    xattr: bool,
}

async fn add_share_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Json(req): Json<ShareRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    let tag = req.mount_tag.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| {
            filesystem::add_virtiofs_share(conn, &name2, &req.source_dir, &req.mount_tag, req.xattr)
        })
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))??;
    Ok(Json(
        serde_json::json!({ "status": "shared", "name": name, "mount_tag": tag }),
    ))
}

async fn remove_share_handler(
    State(manager): State<LibvirtManager>,
    Path((name, mount_tag)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    let tag2 = mount_tag.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| filesystem::remove_share(conn, &name2, &tag2))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))??;
    Ok(Json(
        serde_json::json!({ "status": "removed", "name": name, "mount_tag": mount_tag }),
    ))
}

// ── Save/Restore ────────────────────────────────────────────────────

async fn managed_save_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| save_restore::managed_save(conn, &name2))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))??;
    Ok(Json(serde_json::json!({ "status": "saved", "name": name })))
}

async fn managed_save_remove_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| save_restore::managed_save_remove(conn, &name2))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))??;
    Ok(Json(
        serde_json::json!({ "status": "removed", "name": name }),
    ))
}

async fn has_managed_save_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    let result = tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| save_restore::has_managed_save(conn, &name2))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?;
    let has_save = result?;
    Ok(Json(
        serde_json::json!({ "name": name, "has_managed_save": has_save }),
    ))
}

// ── Boot ────────────────────────────────────────────────────────────

async fn get_boot_config_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| boot::get_boot_config(conn, &name))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?;
    Ok(Json(serde_json::json!(result?)))
}

#[derive(serde::Deserialize)]
struct BootOrderRequest {
    devices: Vec<String>,
}

async fn set_boot_order_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Json(req): Json<BootOrderRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    let devices = req.devices.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| boot::set_boot_order(conn, &name2, &devices))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))??;
    Ok(Json(
        serde_json::json!({ "status": "ok", "name": name, "boot_devices": req.devices }),
    ))
}

// ── Migration ───────────────────────────────────────────────────────

#[derive(serde::Deserialize)]
struct MigrateRequest {
    dest_uri: String,
    #[serde(default)]
    live: bool,
    #[serde(default)]
    parameters: Option<migrate::MigrateParametersApi>,
    /// OR with libvirt flags, e.g. unsafe (512), postcopy (32768), undefine source (16).
    #[serde(default)]
    extra_flags: u32,
    #[serde(default)]
    unsafe_migrate: bool,
    #[serde(default)]
    postcopy: bool,
    #[serde(default)]
    undefine_source: bool,
    #[serde(default)]
    tunnelled: bool,
    #[serde(default)]
    paused: bool,
}

async fn migrate_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Json(req): Json<MigrateRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    let dest_uri = req.dest_uri.clone();
    let destination = dest_uri.clone();
    let live = req.live;
    let params = req.parameters.clone();
    let mut xf = req.extra_flags;
    if req.unsafe_migrate {
        xf |= virt::sys::VIR_MIGRATE_UNSAFE;
    }
    if req.postcopy {
        xf |= virt::sys::VIR_MIGRATE_POSTCOPY;
    }
    if req.undefine_source {
        xf |= virt::sys::VIR_MIGRATE_UNDEFINE_SOURCE;
    }
    if req.tunnelled {
        xf |= virt::sys::VIR_MIGRATE_TUNNELLED;
    }
    if req.paused {
        xf |= virt::sys::VIR_MIGRATE_PAUSED;
    }
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| {
            migrate::migrate_vm_uri(conn, &name2, &dest_uri, live, params.as_ref(), xf)
        })
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))??;
    Ok(Json(
        serde_json::json!({ "status": "migrated", "name": name, "destination": destination }),
    ))
}

async fn migrate_get_max_speed_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    let mib = tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| migrate::migrate_get_max_speed(conn, &name2))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?;
    Ok(Json(
        serde_json::json!({ "name": name, "mib_per_sec": mib? }),
    ))
}

#[derive(serde::Deserialize)]
struct MigrateBandwidthBody {
    mib_per_sec: u64,
}

async fn migrate_set_max_speed_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Json(req): Json<MigrateBandwidthBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    let mib = req.mib_per_sec;
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| migrate::migrate_set_max_speed(conn, &name2, mib))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))??;
    Ok(Json(
        serde_json::json!({ "status": "ok", "name": name, "mib_per_sec": mib }),
    ))
}

#[derive(serde::Deserialize)]
struct MigrateDowntimeBody {
    downtime_ns: u64,
}

async fn migrate_set_max_downtime_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Json(req): Json<MigrateDowntimeBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    let ns = req.downtime_ns;
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| migrate::migrate_set_max_downtime(conn, &name2, ns))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))??;
    Ok(Json(
        serde_json::json!({ "status": "ok", "name": name, "downtime_ns": ns }),
    ))
}

async fn get_numa_tune_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    let result = tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| numa_tune::get_numa_tune(conn, &name2))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?;
    Ok(Json(serde_json::json!(result?)))
}

async fn set_numa_tune_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Json(req): Json<numa_tune::SetNumaTuneRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    let body = req;
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| numa_tune::set_numa_tune(conn, &name2, &body))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))??;
    Ok(Json(serde_json::json!({ "status": "ok", "name": name })))
}

#[derive(serde::Deserialize)]
struct EmulatorPinBody {
    cpus: Vec<bool>,
}

async fn pin_emulator_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Json(req): Json<EmulatorPinBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    let cpus = req.cpus.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| emulator::pin_emulator(conn, &name2, &cpus))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))??;
    Ok(Json(serde_json::json!({ "status": "ok", "name": name })))
}

#[derive(serde::Deserialize)]
struct CpuCompareBody {
    cpu_xml: String,
    #[serde(default)]
    flags: u32,
}

async fn compare_cpu_handler(
    State(manager): State<LibvirtManager>,
    Json(req): Json<CpuCompareBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let xml = req.cpu_xml.clone();
    let flags = req.flags;
    let result = tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| host_cpu::compare_cpu(conn, &xml, flags))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?;
    Ok(Json(serde_json::json!(result?)))
}

async fn job_info_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    let result = tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| domain_job::job_info(conn, &name2))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?;
    Ok(Json(result?))
}

#[derive(serde::Deserialize)]
struct JobStatsQuery {
    #[serde(default)]
    flags: u32,
}

async fn job_stats_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Query(query): Query<JobStatsQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    let flags = query.flags;
    let result = tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| domain_job::job_stats_u32(conn, &name2, flags))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?;
    Ok(Json(result?))
}

// ── Capabilities ────────────────────────────────────────────────────

async fn get_capabilities_handler(
    State(manager): State<LibvirtManager>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result =
        tokio::task::spawn_blocking(move || manager.with_conn(capabilities::get_capabilities))
            .await
            .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?;
    Ok(Json(serde_json::json!(result?)))
}

async fn get_sysinfo_handler(State(manager): State<LibvirtManager>) -> Result<Xml, AppError> {
    let result = tokio::task::spawn_blocking(move || manager.with_conn(capabilities::get_sysinfo))
        .await
        .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?;
    Ok(Xml(result?))
}

// ── Node Devices ────────────────────────────────────────────────────

#[derive(serde::Deserialize)]
struct DeviceQuery {
    #[serde(default)]
    capability: Option<String>,
}

async fn list_node_devices_handler(
    State(manager): State<LibvirtManager>,
    Query(query): Query<DeviceQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| node_device::list_node_devices(conn, query.capability.as_deref()))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?;
    Ok(Json(serde_json::json!(result?)))
}

async fn get_node_device_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Xml, AppError> {
    let result = tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| node_device::get_node_device_xml(conn, &name))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?;
    Ok(Xml(result?))
}

// ── Network Filters ─────────────────────────────────────────────────

async fn list_nwfilters_handler(
    State(manager): State<LibvirtManager>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = tokio::task::spawn_blocking(move || manager.with_conn(nwfilter::list_nwfilters))
        .await
        .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?;
    Ok(Json(serde_json::json!(result?)))
}

async fn get_nwfilter_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Xml, AppError> {
    let result = tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| nwfilter::get_nwfilter_xml(conn, &name))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?;
    Ok(Xml(result?))
}

async fn delete_nwfilter_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| nwfilter::delete_nwfilter(conn, &name2))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))??;
    Ok(Json(
        serde_json::json!({ "status": "deleted", "name": name }),
    ))
}

#[derive(serde::Deserialize)]
struct DefineNwfilterRequest {
    xml: String,
}

async fn define_nwfilter_handler(
    State(manager): State<LibvirtManager>,
    Json(req): Json<DefineNwfilterRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let xml = req.xml;
    let name = tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| nwfilter::define_nwfilter(conn, &xml))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))??;
    Ok(Json(
        serde_json::json!({ "status": "defined", "name": name }),
    ))
}

// ── Secrets ─────────────────────────────────────────────────────────

async fn list_secrets_handler(
    State(manager): State<LibvirtManager>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = tokio::task::spawn_blocking(move || manager.with_conn(secret::list_secrets))
        .await
        .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?;
    Ok(Json(serde_json::json!(result?)))
}

async fn delete_secret_handler(
    State(manager): State<LibvirtManager>,
    Path(uuid): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let uuid2 = uuid.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| secret::delete_secret(conn, &uuid2))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))??;
    Ok(Json(
        serde_json::json!({ "status": "deleted", "uuid": uuid }),
    ))
}

#[derive(serde::Deserialize)]
struct DefineSecretRequest {
    xml: String,
    #[serde(default)]
    value_base64: Option<String>,
    #[serde(default)]
    validate_xml: bool,
    #[serde(default)]
    set_value_flags: u32,
}

async fn define_secret_handler(
    State(manager): State<LibvirtManager>,
    Json(req): Json<DefineSecretRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    use base64::Engine;
    let value_bytes: Option<Vec<u8>> = if let Some(b64) = &req.value_base64 {
        Some(
            base64::engine::general_purpose::STANDARD
                .decode(b64.trim())
                .map_err(|e| LibvirtError::Invalid(format!("value_base64: {e}")))?,
        )
    } else {
        None
    };
    let xml = req.xml.clone();
    let validate = req.validate_xml;
    let svf = req.set_value_flags;
    let uuid = tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| {
            secret::define_secret_with_value(conn, &xml, value_bytes.as_deref(), validate, svf)
        })
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))??;
    Ok(Json(
        serde_json::json!({ "status": "defined", "uuid": uuid }),
    ))
}

#[derive(serde::Deserialize)]
struct PciHostdevBody {
    pci: String,
}

async fn attach_pci_hostdev_handler(
    Extension(actor): Extension<RequestActor>,
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Json(req): Json<PciHostdevBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_usb_pci(&actor)?;
    let pci = req.pci.clone();
    let pci_for_task = pci.clone();
    let name2 = name.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| hostdev_pci::attach_pci_hostdev(conn, &name2, &pci_for_task))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))??;
    Ok(Json(
        serde_json::json!({ "status": "pci_attached", "name": name, "pci": pci }),
    ))
}

async fn detach_pci_hostdev_handler(
    Extension(actor): Extension<RequestActor>,
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Json(req): Json<PciHostdevBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_usb_pci(&actor)?;
    let pci = req.pci.clone();
    let pci_for_task = pci.clone();
    let name2 = name.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| hostdev_pci::detach_pci_hostdev(conn, &name2, &pci_for_task))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))??;
    Ok(Json(
        serde_json::json!({ "status": "pci_detached", "name": name, "pci": pci }),
    ))
}

async fn detach_nodedev_handler(
    Extension(actor): Extension<RequestActor>,
    State(manager): State<LibvirtManager>,
    Path(devname): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_usb_pci(&actor)?;
    let dev = devname.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| node_device::detach_node_device(conn, &dev))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))??;
    Ok(Json(
        serde_json::json!({ "status": "nodedev_detached", "name": devname }),
    ))
}

async fn reattach_nodedev_handler(
    Extension(actor): Extension<RequestActor>,
    State(manager): State<LibvirtManager>,
    Path(devname): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_usb_pci(&actor)?;
    let dev = devname.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| node_device::reattach_node_device(conn, &dev))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))??;
    Ok(Json(
        serde_json::json!({ "status": "nodedev_reattached", "name": devname }),
    ))
}

// ── Storage Pool Create/Delete ──────────────────────────────────────

#[derive(serde::Deserialize)]
struct CreatePoolRequest {
    name: String,
    #[serde(default = "default_pool_type")]
    pool_type: String,
    target_path: String,
}

fn default_pool_type() -> String {
    "dir".to_string()
}

async fn create_pool_handler(
    State(manager): State<LibvirtManager>,
    Json(req): Json<CreatePoolRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let req_name = req.name.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| {
            storage::create_pool(conn, &req.name, &req.pool_type, &req.target_path)
        })
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))??;
    Ok(Json(
        serde_json::json!({ "status": "created", "name": req_name }),
    ))
}

async fn delete_pool_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| storage::delete_pool(conn, &name2))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))??;
    Ok(Json(
        serde_json::json!({ "status": "deleted", "name": name }),
    ))
}

async fn get_pool_xml_handler(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Xml, AppError> {
    let result = tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| storage::get_pool_xml(conn, &name))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?;
    Ok(Xml(result?))
}

// ── Volume Resize/Clone ─────────────────────────────────────────────

#[derive(serde::Deserialize)]
struct ResizeVolumeRequest {
    capacity_gb: f64,
}

async fn resize_volume_handler(
    State(manager): State<LibvirtManager>,
    Path((pool, vol)): Path<(String, String)>,
    Json(req): Json<ResizeVolumeRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    if req.capacity_gb <= 0.0 || req.capacity_gb > 10_240.0 {
        return Err(machina_core::LibvirtError::Operation(
            "capacity_gb must be between 0 and 10240 (10 TB)".to_string(),
        )
        .into());
    }
    let capacity = req.capacity_gb.ceil() as u64;
    let pool2 = pool.clone();
    let vol2 = vol.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| storage::resize_volume(conn, &pool2, &vol2, capacity))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))??;
    Ok(Json(
        serde_json::json!({ "status": "resized", "pool": pool, "volume": vol, "capacity_gb": capacity }),
    ))
}

#[derive(serde::Deserialize)]
struct CloneVolumeRequest {
    new_name: String,
}

async fn clone_volume_handler(
    State(manager): State<LibvirtManager>,
    Path((pool, vol)): Path<(String, String)>,
    Json(req): Json<CloneVolumeRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let pool2 = pool.clone();
    let vol2 = vol.clone();
    let new_name = req.new_name.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| storage::clone_volume(conn, &pool2, &vol2, &new_name))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))??;
    Ok(Json(
        serde_json::json!({ "status": "cloned", "pool": pool, "source": vol, "clone": req.new_name }),
    ))
}

// ── Memory Balloon ──────────────────────────────────────────────────

async fn set_memory_balloon_handler(
    State(manager): State<LibvirtManager>,
    Path((name, mb)): Path<(String, u64)>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    tokio::task::spawn_blocking(move || {
        manager
            .with_conn(|conn| machina_core::libvirt::resize::set_memory_balloon(conn, &name2, mb))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))??;
    Ok(Json(
        serde_json::json!({ "status": "ok", "name": name, "memory_mb": mb }),
    ))
}

// ── Routes ──────────────────────────────────────────────────────────

pub fn advanced_routes() -> Router<LibvirtManager> {
    Router::new()
        // Guest agent
        .route("/vms/{name}/interfaces", get(get_interfaces))
        .route("/vms/{name}/hostname", get(get_hostname))
        // CD-ROM
        .route("/vms/{name}/cdrom/insert", post(insert_cdrom_handler))
        .route(
            "/vms/{name}/cdrom/eject/{target}",
            post(eject_cdrom_handler),
        )
        // Shared directories (virtiofs)
        .route("/vms/{name}/share", post(add_share_handler))
        .route(
            "/vms/{name}/share/{mount_tag}",
            delete(remove_share_handler),
        )
        // Save/Restore
        .route("/vms/{name}/managed-save", post(managed_save_handler))
        .route(
            "/vms/{name}/managed-save",
            delete(managed_save_remove_handler),
        )
        .route(
            "/vms/{name}/managed-save/status",
            get(has_managed_save_handler),
        )
        // Boot
        .route("/vms/{name}/boot", get(get_boot_config_handler))
        .route("/vms/{name}/boot", post(set_boot_order_handler))
        // Migration + tuning
        .route("/vms/{name}/migrate", post(migrate_handler))
        .route(
            "/vms/{name}/migrate/max-bandwidth",
            get(migrate_get_max_speed_handler).post(migrate_set_max_speed_handler),
        )
        .route(
            "/vms/{name}/migrate/max-downtime",
            post(migrate_set_max_downtime_handler),
        )
        .route(
            "/vms/{name}/numa",
            get(get_numa_tune_handler).post(set_numa_tune_handler),
        )
        .route("/vms/{name}/emulator/pin", post(pin_emulator_handler))
        .route("/vms/{name}/job", get(job_info_handler))
        .route("/vms/{name}/job/stats", get(job_stats_handler))
        .route("/cpu/compare", post(compare_cpu_handler))
        // Memory balloon
        .route("/vms/{name}/balloon/{mb}", post(set_memory_balloon_handler))
        // Capabilities
        .route("/capabilities", get(get_capabilities_handler))
        .route("/sysinfo", get(get_sysinfo_handler))
        // Node devices
        .route("/devices", get(list_node_devices_handler))
        .route("/devices/{name}", get(get_node_device_handler))
        // Network filters
        .route(
            "/nwfilters",
            get(list_nwfilters_handler).post(define_nwfilter_handler),
        )
        .route("/nwfilters/{name}", get(get_nwfilter_handler))
        .route("/nwfilters/{name}", delete(delete_nwfilter_handler))
        // Secrets
        .route(
            "/secrets",
            get(list_secrets_handler).post(define_secret_handler),
        )
        .route("/secrets/{uuid}", delete(delete_secret_handler))
        // PCI hostdev + node device detach (VFIO prep)
        .route(
            "/vms/{name}/hostdev/pci/attach",
            post(attach_pci_hostdev_handler),
        )
        .route(
            "/vms/{name}/hostdev/pci/detach",
            post(detach_pci_hostdev_handler),
        )
        .route("/host/nodedev/{name}/detach", post(detach_nodedev_handler))
        .route(
            "/host/nodedev/{name}/reattach",
            post(reattach_nodedev_handler),
        )
        // Storage pool management
        .route("/storage/pools", post(create_pool_handler))
        .route("/storage/pools/{name}", delete(delete_pool_handler))
        .route("/storage/pools/{name}/xml", get(get_pool_xml_handler))
        // Volume resize/clone
        .route(
            "/storage/pools/{pool}/volumes/{vol}/resize",
            post(resize_volume_handler),
        )
        .route(
            "/storage/pools/{pool}/volumes/{vol}/clone",
            post(clone_volume_handler),
        )
}
