//! OpenStack Nova instance management and native Glance image upload.

use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    routing::{delete, get, post},
    Extension, Json, Router,
};
use machina_core::{
    add_security_group, associate_floating_ip, attach_volume, audit, connection_status_skeleton,
    create_instance, delete_glance_image, delete_instance, detach_volume, dissociate_floating_ip,
    pull_glance_image_to_disk,
    enrich_instance_flavor, export_instance_plan, export_instance_to_disk, get_console_output,
    get_instance,
    get_remote_console, is_openstack_configured, list_flavors, list_floating_ips,
    list_cinder_volumes, list_images, list_instance_floating_ips, list_instance_volumes,
    list_instances, list_keypairs,
    list_networks, pause_instance, preview_qcow2_upload, reboot_instance, remove_security_group,
    resize_instance, resume_instance, snapshot_instance, start_instance, stop_instance,
    suspend_instance, test_connection, unpause_instance, upload_qcow2_to_glance, AssociateFloatingIpRequest,
    AttachVolumeRequest, AuditEvent, CreateInstanceRequest, CreateInstanceResponse, GlancePullRequest,
    GlancePullResult, GlanceUploadPreview, GlanceUploadRequest, GlanceUploadResult, LibvirtError,
    LibvirtManager, MachinaConfig,
    OpenStackConnectionStatus, OpenStackInstance,
};
use serde::Deserialize;

use crate::error::AppError;
use crate::routes::events::{EventBus, MachinaEvent};

fn emit(bus: &Arc<EventBus>, kind: &str, target: &str, status: &str, message: &str) {
    let mut ev = MachinaEvent::now(kind, target, status);
    ev.message = message.chars().take(512).collect();
    bus.emit(ev);
}

fn log_audit(action: &str, target: &str, result: &str) {
    let event = AuditEvent {
        timestamp: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        action: action.to_string(),
        target: target.to_string(),
        result: result.to_string(),
        actor: String::new(),
    };
    audit::write_audit_event(&event);
}

fn openstack_cfg() -> machina_core::config::OpenStackConfig {
    MachinaConfig::load().openstack
}

fn ensure_openstack_enabled(cfg: &machina_core::config::OpenStackConfig) -> Result<(), AppError> {
    if !is_openstack_configured(cfg) {
        return Err(LibvirtError::Invalid(
            "OpenStack is not configured; set [openstack] enabled = true and cloud_name or auth_url in machina config"
                .into(),
        )
        .into());
    }
    Ok(())
}

// --- Instance API ---

async fn openstack_status() -> Result<Json<OpenStackConnectionStatus>, AppError> {
    let cfg = openstack_cfg();
    let status = if is_openstack_configured(&cfg) {
        test_connection(&cfg).await
    } else {
        connection_status_skeleton(&cfg)
    };
    Ok(Json(status))
}

async fn openstack_test_connection() -> Result<Json<OpenStackConnectionStatus>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    Ok(Json(test_connection(&cfg).await))
}

#[derive(Debug, Deserialize)]
pub struct InstanceListQuery {
    pub search: Option<String>,
    pub status: Option<String>,
}

async fn openstack_list_instances(
    Query(q): Query<InstanceListQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let instances = list_instances(
        &cfg,
        q.search.as_deref(),
        q.status.as_deref(),
    )
    .await?;
    let total = instances.len();
    Ok(Json(serde_json::json!({
        "instances": instances,
        "total": total,
    })))
}

async fn openstack_get_instance(
    Path(id): Path<String>,
) -> Result<Json<OpenStackInstance>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let inst = get_instance(&cfg, &id).await?;
    let inst = enrich_instance_flavor(&cfg, inst).await;
    Ok(Json(inst))
}

async fn openstack_instance_volumes(
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let volumes = list_instance_volumes(&cfg, id.trim()).await?;
    Ok(Json(serde_json::json!({ "volumes": volumes })))
}

#[derive(Debug, Deserialize)]
pub struct SnapshotBody {
    pub image_name: String,
}

async fn openstack_snapshot_instance(
    Extension(bus): Extension<Arc<EventBus>>,
    Path(id): Path<String>,
    Json(body): Json<SnapshotBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let id = id.trim().to_string();
    match snapshot_instance(&cfg, &id, &body.image_name).await {
        Ok(()) => {
            log_audit("openstack.instance.snapshot", &id, "ok");
            emit(
                &bus,
                "openstack.instance.snapshot",
                &id,
                "ok",
                &body.image_name,
            );
            Ok(Json(serde_json::json!({ "status": "ok", "id": id, "image_name": body.image_name })))
        }
        Err(e) => {
            log_audit("openstack.instance.snapshot", &id, "error");
            emit(&bus, "openstack.instance.snapshot", &id, "error", &e.to_string());
            Err(e.into())
        }
    }
}

async fn openstack_delete_instance(
    Extension(bus): Extension<Arc<EventBus>>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let id = id.trim().to_string();
    match delete_instance(&cfg, &id).await {
        Ok(()) => {
            log_audit("openstack.instance.delete", &id, "ok");
            emit(&bus, "openstack.instance.delete", &id, "ok", "");
            Ok(Json(serde_json::json!({ "status": "ok", "id": id })))
        }
        Err(e) => {
            log_audit("openstack.instance.delete", &id, "error");
            emit(&bus, "openstack.instance.delete", &id, "error", &e.to_string());
            Err(e.into())
        }
    }
}

async fn openstack_create_instance(
    Extension(bus): Extension<Arc<EventBus>>,
    Json(req): Json<CreateInstanceRequest>,
) -> Result<Json<CreateInstanceResponse>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    match create_instance(&cfg, &req).await {
        Ok(resp) => {
            log_audit("openstack.instance.create", &resp.id, "ok");
            emit(&bus, "openstack.instance.create", &resp.id, "ok", &resp.name);
            Ok(Json(resp))
        }
        Err(e) => {
            log_audit("openstack.instance.create", &req.name, "error");
            emit(
                &bus,
                "openstack.instance.create",
                &req.name,
                "error",
                &e.to_string(),
            );
            Err(e.into())
        }
    }
}

async fn openstack_list_flavors() -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let flavors = list_flavors(&cfg).await?;
    Ok(Json(serde_json::json!({ "flavors": flavors })))
}

async fn openstack_list_networks() -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let networks = list_networks(&cfg).await?;
    Ok(Json(serde_json::json!({ "networks": networks })))
}

async fn openstack_list_images() -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let images = list_images(&cfg).await?;
    Ok(Json(serde_json::json!({ "images": images })))
}

async fn openstack_delete_image(
    Extension(bus): Extension<Arc<EventBus>>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let id = id.trim().to_string();
    match delete_glance_image(&cfg, &id).await {
        Ok(()) => {
            log_audit("openstack.image.delete", &id, "ok");
            emit(&bus, "openstack.image.delete", &id, "ok", "");
            Ok(Json(serde_json::json!({ "status": "ok", "id": id })))
        }
        Err(e) => {
            log_audit("openstack.image.delete", &id, "error");
            emit(&bus, "openstack.image.delete", &id, "error", &e.to_string());
            Err(e.into())
        }
    }
}

async fn openstack_list_keypairs() -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let keypairs = list_keypairs(&cfg).await?;
    Ok(Json(serde_json::json!({ "keypairs": keypairs })))
}

async fn openstack_start_instance(
    Extension(bus): Extension<Arc<EventBus>>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let id = id.trim().to_string();
    match start_instance(&cfg, &id).await {
        Ok(()) => {
            log_audit("openstack.instance.start", &id, "ok");
            emit(&bus, "openstack.instance.start", &id, "ok", "");
            Ok(Json(serde_json::json!({ "status": "ok", "id": id })))
        }
        Err(e) => {
            log_audit("openstack.instance.start", &id, "error");
            emit(&bus, "openstack.instance.start", &id, "error", &e.to_string());
            Err(e.into())
        }
    }
}

async fn openstack_stop_instance(
    Extension(bus): Extension<Arc<EventBus>>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let id = id.trim().to_string();
    match stop_instance(&cfg, &id).await {
        Ok(()) => {
            log_audit("openstack.instance.stop", &id, "ok");
            emit(&bus, "openstack.instance.stop", &id, "ok", "");
            Ok(Json(serde_json::json!({ "status": "ok", "id": id })))
        }
        Err(e) => {
            log_audit("openstack.instance.stop", &id, "error");
            emit(&bus, "openstack.instance.stop", &id, "error", &e.to_string());
            Err(e.into())
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct RebootBody {
    #[serde(default)]
    pub reboot_type: Option<String>,
}

async fn openstack_reboot_instance(
    Extension(bus): Extension<Arc<EventBus>>,
    Path(id): Path<String>,
    body: Option<Json<RebootBody>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let id = id.trim().to_string();
    let soft = body
        .as_ref()
        .and_then(|b| b.reboot_type.as_deref())
        .map(|t| t.eq_ignore_ascii_case("soft"))
        .unwrap_or(false);
    match reboot_instance(&cfg, &id, soft).await {
        Ok(()) => {
            log_audit("openstack.instance.reboot", &id, "ok");
            emit(&bus, "openstack.instance.reboot", &id, "ok", "");
            Ok(Json(serde_json::json!({ "status": "ok", "id": id, "soft": soft })))
        }
        Err(e) => {
            log_audit("openstack.instance.reboot", &id, "error");
            emit(&bus, "openstack.instance.reboot", &id, "error", &e.to_string());
            Err(e.into())
        }
    }
}

// --- qcow2 → Glance (native Rust) ---

#[derive(Debug, Deserialize)]
pub struct ImageUploadPreviewQuery {
    pub qcow2_path: String,
}

fn validate_qcow2_allowed(path: &str, allowed_prefixes: &[String]) -> Result<(), LibvirtError> {
    if !allowed_prefixes.iter().any(|p| path.starts_with(p)) {
        return Err(LibvirtError::Invalid(format!(
            "Path not in an allowed images directory: {path}"
        )));
    }
    Ok(())
}

async fn allowed_prefixes(manager: &LibvirtManager) -> Result<Vec<String>, AppError> {
    tokio::task::spawn_blocking({
        let mgr = manager.clone();
        move || mgr.with_conn(machina_core::libvirt::storage::disk_image_delete_allowed_prefixes)
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
    .map_err(AppError::from)
}

async fn openstack_image_upload_preview(
    State(manager): State<LibvirtManager>,
    Query(q): Query<ImageUploadPreviewQuery>,
) -> Result<Json<GlanceUploadPreview>, AppError> {
    let path = q.qcow2_path.trim();
    if path.is_empty() {
        return Err(AppError::from(LibvirtError::Invalid(
            "qcow2_path query parameter is required".into(),
        )));
    }
    let prefixes = allowed_prefixes(&manager).await?;
    validate_qcow2_allowed(path, &prefixes)?;
    let preview = preview_qcow2_upload(path)?;
    log_audit("openstack-image-upload-preview", path, "ok");
    Ok(Json(preview))
}

async fn openstack_image_upload(
    State(manager): State<LibvirtManager>,
    Extension(bus): Extension<Arc<EventBus>>,
    Json(req): Json<GlanceUploadRequest>,
) -> Result<Json<GlanceUploadResult>, AppError> {
    let path = req.qcow2_path.trim();
    if path.is_empty() {
        return Err(AppError::from(LibvirtError::Invalid(
            "qcow2_path is required".into(),
        )));
    }
    let prefixes = allowed_prefixes(&manager).await?;
    validate_qcow2_allowed(path, &prefixes)?;
    let cfg = MachinaConfig::load().openstack;
    ensure_openstack_enabled(&cfg)?;
    match upload_qcow2_to_glance(&cfg, &req).await {
        Ok(result) => {
            log_audit("openstack-image-upload", path, "ok");
            emit(
                &bus,
                "openstack.image.upload",
                path,
                "ok",
                &result.image_name,
            );
            Ok(Json(result))
        }
        Err(e) => {
            log_audit("openstack-image-upload", path, "error");
            emit(&bus, "openstack.image.upload", path, "error", &e.to_string());
            Err(e.into())
        }
    }
}

macro_rules! instance_action {
    ($fn:ident, $core:expr, $audit:expr, $kind:expr) => {
        async fn $fn(
            Extension(bus): Extension<Arc<EventBus>>,
            Path(id): Path<String>,
        ) -> Result<Json<serde_json::Value>, AppError> {
            let cfg = openstack_cfg();
            ensure_openstack_enabled(&cfg)?;
            let id = id.trim().to_string();
            match $core(&cfg, &id).await {
                Ok(()) => {
                    log_audit($audit, &id, "ok");
                    emit(&bus, $kind, &id, "ok", "");
                    Ok(Json(serde_json::json!({ "status": "ok", "id": id })))
                }
                Err(e) => {
                    log_audit($audit, &id, "error");
                    emit(&bus, $kind, &id, "error", &e.to_string());
                    Err(e.into())
                }
            }
        }
    };
}

instance_action!(openstack_pause_instance, pause_instance, "openstack.instance.pause", "openstack.instance.pause");
instance_action!(openstack_unpause_instance, unpause_instance, "openstack.instance.unpause", "openstack.instance.unpause");
instance_action!(openstack_suspend_instance, suspend_instance, "openstack.instance.suspend", "openstack.instance.suspend");
instance_action!(openstack_resume_instance, resume_instance, "openstack.instance.resume", "openstack.instance.resume");

#[derive(Debug, Deserialize)]
struct ResizeBody {
    pub flavor: String,
}

async fn openstack_resize_instance(
    Extension(bus): Extension<Arc<EventBus>>,
    Path(id): Path<String>,
    Json(body): Json<ResizeBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let id = id.trim().to_string();
    match resize_instance(&cfg, &id, &body.flavor).await {
        Ok(()) => {
            log_audit("openstack.instance.resize", &id, "ok");
            emit(&bus, "openstack.instance.resize", &id, "ok", &body.flavor);
            Ok(Json(serde_json::json!({ "status": "ok", "id": id })))
        }
        Err(e) => {
            log_audit("openstack.instance.resize", &id, "error");
            emit(&bus, "openstack.instance.resize", &id, "error", &e.to_string());
            Err(e.into())
        }
    }
}

#[derive(Debug, Deserialize)]
struct ConsoleQuery {
    pub lines: Option<u64>,
    #[serde(rename = "type")]
    pub console_type: Option<String>,
}

async fn openstack_console_output(
    Path(id): Path<String>,
    Query(q): Query<ConsoleQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let out = get_console_output(&cfg, &id, q.lines).await?;
    Ok(Json(serde_json::json!(out)))
}

async fn openstack_remote_console(
    Path(id): Path<String>,
    Query(q): Query<ConsoleQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let typ = q.console_type.as_deref().unwrap_or("novnc");
    let console = get_remote_console(&cfg, &id, typ).await?;
    Ok(Json(serde_json::json!(console)))
}

async fn openstack_attach_volume(
    Extension(bus): Extension<Arc<EventBus>>,
    Path(id): Path<String>,
    Json(body): Json<AttachVolumeRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let id = id.trim().to_string();
    match attach_volume(&cfg, &id, &body.volume_id).await {
        Ok(()) => {
            log_audit("openstack.volume.attach", &id, "ok");
            emit(&bus, "openstack.volume.attach", &id, "ok", &body.volume_id);
            Ok(Json(serde_json::json!({ "status": "ok", "id": id })))
        }
        Err(e) => Err(e.into()),
    }
}

async fn openstack_detach_volume(
    Extension(bus): Extension<Arc<EventBus>>,
    Path((id, vol_id)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let id = id.trim().to_string();
    match detach_volume(&cfg, &id, &vol_id).await {
        Ok(()) => {
            log_audit("openstack.volume.detach", &id, "ok");
            emit(&bus, "openstack.volume.detach", &id, "ok", &vol_id);
            Ok(Json(serde_json::json!({ "status": "ok", "id": id })))
        }
        Err(e) => Err(e.into()),
    }
}

#[derive(Debug, Deserialize)]
struct ExportBody {
    pub image_name: Option<String>,
    /// When set with `auto_pull`, download Glance image to this path after snapshot.
    pub dest_path: Option<String>,
    #[serde(default)]
    pub auto_pull: bool,
    #[serde(default)]
    pub wait_for_active: Option<bool>,
}

async fn openstack_export_instance(
    State(manager): State<LibvirtManager>,
    Extension(bus): Extension<Arc<EventBus>>,
    Path(id): Path<String>,
    Json(body): Json<ExportBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let id = id.trim().to_string();
    if body.auto_pull {
        let dest = body
            .dest_path
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .ok_or_else(|| {
                AppError::from(LibvirtError::Invalid(
                    "dest_path is required when auto_pull is true".into(),
                ))
            })?;
        let prefixes = allowed_prefixes(&manager).await?;
        let wait = body.wait_for_active.unwrap_or(true);
        let plan = export_instance_to_disk(
            &cfg,
            &id,
            body.image_name.as_deref(),
            dest,
            &prefixes,
            wait,
        )
        .await?;
        if let Some(ref pull) = plan.pull {
            log_audit("openstack-export-pull", &pull.dest_path, "ok");
            emit(
                &bus,
                "openstack.image.pull",
                &plan.image_id.clone().unwrap_or_default(),
                "ok",
                &pull.dest_path,
            );
        }
        return Ok(Json(serde_json::json!(plan)));
    }
    let plan = export_instance_plan(&cfg, &id, body.image_name.as_deref()).await?;
    Ok(Json(serde_json::json!(plan)))
}

#[derive(Debug, Deserialize)]
struct SecurityGroupBody {
    pub name: String,
}

async fn openstack_add_security_group(
    Path(id): Path<String>,
    Json(body): Json<SecurityGroupBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    add_security_group(&cfg, &id, &body.name).await?;
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

async fn openstack_remove_security_group(
    Path(id): Path<String>,
    Json(body): Json<SecurityGroupBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    remove_security_group(&cfg, &id, &body.name).await?;
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

async fn openstack_list_cinder_volumes() -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let volumes = list_cinder_volumes(&cfg).await?;
    Ok(Json(serde_json::json!({ "volumes": volumes })))
}

async fn openstack_list_floating_ips_route() -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let fips = list_floating_ips(&cfg).await?;
    Ok(Json(serde_json::json!({ "floating_ips": fips })))
}

async fn openstack_instance_floating_ips(
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let fips = list_instance_floating_ips(&cfg, &id).await?;
    Ok(Json(serde_json::json!({ "floating_ips": fips })))
}

async fn openstack_associate_floating_ip(
    Path(id): Path<String>,
    Json(body): Json<AssociateFloatingIpRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let fip = associate_floating_ip(&cfg, &id, &body).await?;
    Ok(Json(serde_json::json!({ "floating_ip": fip })))
}

async fn openstack_dissociate_floating_ip(
    Path(fip_id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    dissociate_floating_ip(&cfg, &fip_id).await?;
    Ok(Json(serde_json::json!({ "status": "ok", "id": fip_id })))
}

pub fn openstack_routes() -> Router<LibvirtManager> {
    Router::new()
        .route("/openstack/status", get(openstack_status))
        .route("/openstack/test-connection", post(openstack_test_connection))
        .route("/openstack/flavors", get(openstack_list_flavors))
        .route("/openstack/networks", get(openstack_list_networks))
        .route(
            "/openstack/images",
            get(openstack_list_images),
        )
        .route("/openstack/images/{id}", delete(openstack_delete_image))
        .route("/openstack/keypairs", get(openstack_list_keypairs))
        .route("/openstack/instances", get(openstack_list_instances).post(openstack_create_instance))
        .route(
            "/openstack/instances/{id}",
            get(openstack_get_instance).delete(openstack_delete_instance),
        )
        .route("/openstack/instances/{id}/volumes", get(openstack_instance_volumes))
        .route("/openstack/instances/{id}/start", post(openstack_start_instance))
        .route("/openstack/instances/{id}/stop", post(openstack_stop_instance))
        .route("/openstack/instances/{id}/reboot", post(openstack_reboot_instance))
        .route("/openstack/instances/{id}/snapshot", post(openstack_snapshot_instance))
        .route("/openstack/instances/{id}/pause", post(openstack_pause_instance))
        .route("/openstack/instances/{id}/unpause", post(openstack_unpause_instance))
        .route("/openstack/instances/{id}/suspend", post(openstack_suspend_instance))
        .route("/openstack/instances/{id}/resume", post(openstack_resume_instance))
        .route("/openstack/instances/{id}/resize", post(openstack_resize_instance))
        .route("/openstack/instances/{id}/console-output", get(openstack_console_output))
        .route("/openstack/instances/{id}/console", get(openstack_remote_console))
        .route("/openstack/instances/{id}/volumes/attach", post(openstack_attach_volume))
        .route(
            "/openstack/instances/{id}/volumes/{vol_id}",
            delete(openstack_detach_volume),
        )
        .route("/openstack/instances/{id}/export", post(openstack_export_instance))
        .route(
            "/openstack/instances/{id}/security-groups",
            post(openstack_add_security_group),
        )
        .route(
            "/openstack/instances/{id}/security-groups/remove",
            post(openstack_remove_security_group),
        )
        .route("/openstack/volumes", get(openstack_list_cinder_volumes))
        .route("/openstack/floating-ips", get(openstack_list_floating_ips_route))
        .route(
            "/openstack/instances/{id}/floating-ips",
            get(openstack_instance_floating_ips).post(openstack_associate_floating_ip),
        )
        .route(
            "/openstack/floating-ips/{id}/dissociate",
            post(openstack_dissociate_floating_ip),
        )
        .route("/openstack/images/upload/preview", get(openstack_image_upload_preview))
        .route("/openstack/images/upload", post(openstack_image_upload))
        .route("/openstack/images/{id}/pull", post(openstack_image_pull))
}

async fn openstack_image_pull(
    State(manager): State<LibvirtManager>,
    Extension(bus): Extension<Arc<EventBus>>,
    Path(id): Path<String>,
    Json(req): Json<GlancePullRequest>,
) -> Result<Json<GlancePullResult>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let prefixes = allowed_prefixes(&manager).await?;
    let result = pull_glance_image_to_disk(&cfg, &id, &req, &prefixes).await?;
    log_audit("openstack-image-pull", &result.dest_path, "ok");
    emit(
        &bus,
        "openstack.image.pull",
        &id,
        "ok",
        &result.dest_path,
    );
    Ok(Json(result))
}
