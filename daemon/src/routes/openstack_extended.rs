// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

//! Extended OpenStack API routes (v2).

use std::sync::Arc;

use axum::{
    body::Body,
    extract::{Path, Query},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::{delete, get, post},
    Extension, Json, Router,
};
use machina_core::{
    add_image_member, attach_interface, backup_instance, create_keypair, create_security_group,
    create_security_group_rule, delete_image_member, delete_keypair, delete_security_group,
    delete_security_group_rule, detach_interface, extend_cinder_volume, get_quota_summary,
    instance_stack_hint, list_configured_clouds, list_image_members,
    list_instance_interfaces, list_ports, list_routers, list_server_groups, list_subnets,
    list_volume_types, migrate_instance, remote_console_with_tunnel, rescue_instance,
    resolve_console_token, shelve_instance, snapshot_cinder_volume, unrescue_instance,
    unshelve_instance, update_image_metadata, AddImageMemberRequest, AttachInterfaceRequest,
    BackupInstanceRequest, CreateKeypairRequest, CreateSecurityGroupRequest,
    CreateSecurityGroupRuleRequest, ExtendVolumeRequest, LibvirtManager, MigrateInstanceRequest,
    RescueInstanceRequest, SnapshotVolumeRequest, UpdateImageMetadataRequest,
};
use reqwest::Client;
use serde::Deserialize;

use crate::routes::openstack::{ensure_openstack_enabled, log_audit};
use crate::error::AppError;
use crate::openstack_runtime::{self, openstack_cfg};
use crate::routes::events::{EventBus, MachinaEvent};

fn emit(bus: &Arc<EventBus>, kind: &str, target: &str, status: &str, message: &str) {
    let mut ev = MachinaEvent::now(kind, target, status);
    ev.message = message.chars().take(512).collect();
    bus.emit(ev);
}

#[derive(Deserialize)]
pub struct ConsoleQuery {
    #[serde(default = "default_novnc")]
    pub r#type: String,
}
fn default_novnc() -> String {
    "novnc".into()
}

pub fn openstack_extended_routes() -> Router<LibvirtManager> {
    Router::new()
        .route("/openstack/clouds", get(os_list_clouds))
        .route("/openstack/cloud", post(os_select_cloud))
        .route("/openstack/quotas", get(os_quotas))
        .route("/openstack/subnets", get(os_subnets))
        .route("/openstack/routers", get(os_routers))
        .route("/openstack/ports", get(os_ports))
        .route("/openstack/volume-types", get(os_volume_types))
        .route("/openstack/server-groups", get(os_server_groups))
        .route("/openstack/keypairs", post(os_create_keypair))
        .route("/openstack/keypairs/{name}", delete(os_delete_keypair))
        .route("/openstack/security-groups", post(os_create_sg))
        .route("/openstack/security-groups/{id}", delete(os_delete_sg))
        .route(
            "/openstack/security-groups/{id}/rules",
            post(os_create_sg_rule),
        )
        .route(
            "/openstack/security-group-rules/{id}",
            delete(os_delete_sg_rule),
        )
        .route("/openstack/volumes/{id}/extend", post(os_extend_volume))
        .route("/openstack/volumes/{id}/snapshot", post(os_snapshot_volume))
        .route("/openstack/images/{id}/metadata", post(os_image_metadata))
        .route("/openstack/images/{id}/members", get(os_image_members).post(os_add_member))
        .route(
            "/openstack/images/{id}/members/{member}",
            delete(os_delete_member),
        )
        .route("/openstack/instances/{id}/shelve", post(os_shelve))
        .route("/openstack/instances/{id}/unshelve", post(os_unshelve))
        .route("/openstack/instances/{id}/migrate", post(os_migrate))
        .route("/openstack/instances/{id}/rescue", post(os_rescue))
        .route("/openstack/instances/{id}/unrescue", post(os_unrescue))
        .route("/openstack/instances/{id}/backup", post(os_backup))
        .route(
            "/openstack/instances/{id}/interfaces",
            get(os_list_if).post(os_attach_if),
        )
        .route(
            "/openstack/instances/{id}/interfaces/{port}",
            delete(os_detach_if),
        )
        .route("/openstack/instances/{id}/stack", get(os_stack_hint))
        .route(
            "/openstack/instances/{id}/console/tunnel",
            get(os_console_tunnel),
        )
        .route("/openstack/console-tunnel/{token}", get(os_console_proxy))
}

async fn os_list_clouds() -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let clouds = list_configured_clouds(&cfg)?;
    Ok(Json(serde_json::json!({ "clouds": clouds })))
}

#[derive(Deserialize)]
struct SelectCloudBody {
    cloud_name: String,
}

async fn os_select_cloud(Json(body): Json<SelectCloudBody>) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let name = body.cloud_name.trim().to_string();
    if name.is_empty() {
        openstack_runtime::set_cloud_override(None);
    } else {
        openstack_runtime::set_cloud_override(Some(name.clone()));
    }
    Ok(Json(serde_json::json!({ "status": "ok", "cloud_name": name })))
}

async fn os_quotas() -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let q = get_quota_summary(&cfg).await?;
    Ok(Json(serde_json::json!({ "quotas": q })))
}

async fn os_subnets() -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    Ok(Json(serde_json::json!({ "subnets": list_subnets(&cfg).await? })))
}

async fn os_routers() -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    Ok(Json(serde_json::json!({ "routers": list_routers(&cfg).await? })))
}

#[derive(Deserialize)]
struct PortsQuery {
    pub device_id: Option<String>,
}

async fn os_ports(Query(q): Query<PortsQuery>) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    Ok(Json(
        serde_json::json!({ "ports": list_ports(&cfg, q.device_id.as_deref()).await? }),
    ))
}

async fn os_volume_types() -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    Ok(Json(
        serde_json::json!({ "volume_types": list_volume_types(&cfg).await? }),
    ))
}

async fn os_server_groups() -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    Ok(Json(
        serde_json::json!({ "server_groups": list_server_groups(&cfg).await? }),
    ))
}

async fn os_create_keypair(Json(req): Json<CreateKeypairRequest>) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let kp = create_keypair(&cfg, &req).await?;
    Ok(Json(serde_json::json!({ "keypair": kp })))
}

async fn os_delete_keypair(Path(name): Path<String>) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    delete_keypair(&cfg, &name).await?;
    Ok(Json(serde_json::json!({ "status": "ok", "name": name })))
}

async fn os_create_sg(Json(req): Json<CreateSecurityGroupRequest>) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let sg = create_security_group(&cfg, &req).await?;
    Ok(Json(serde_json::json!({ "security_group": sg })))
}

async fn os_delete_sg(Path(id): Path<String>) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    delete_security_group(&cfg, &id).await?;
    Ok(Json(serde_json::json!({ "status": "ok", "id": id })))
}

async fn os_create_sg_rule(
    Path(id): Path<String>,
    Json(req): Json<CreateSecurityGroupRuleRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let rule = create_security_group_rule(&cfg, &id, &req).await?;
    Ok(Json(serde_json::json!({ "rule": rule })))
}

async fn os_delete_sg_rule(Path(id): Path<String>) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    delete_security_group_rule(&cfg, &id).await?;
    Ok(Json(serde_json::json!({ "status": "ok", "id": id })))
}

async fn os_extend_volume(
    Path(id): Path<String>,
    Json(req): Json<ExtendVolumeRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let vol = extend_cinder_volume(&cfg, &id, &req).await?;
    Ok(Json(serde_json::json!({ "volume": vol })))
}

async fn os_snapshot_volume(
    Path(id): Path<String>,
    Json(req): Json<SnapshotVolumeRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let snap = snapshot_cinder_volume(&cfg, &id, &req).await?;
    Ok(Json(snap))
}

async fn os_image_metadata(
    Path(id): Path<String>,
    Json(req): Json<UpdateImageMetadataRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let props = update_image_metadata(&cfg, &id, &req).await?;
    Ok(Json(serde_json::json!({ "properties": props })))
}

async fn os_image_members(Path(id): Path<String>) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    Ok(Json(
        serde_json::json!({ "members": list_image_members(&cfg, &id).await? }),
    ))
}

async fn os_add_member(
    Path(id): Path<String>,
    Json(req): Json<AddImageMemberRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let m = add_image_member(&cfg, &id, &req).await?;
    Ok(Json(serde_json::json!({ "member": m })))
}

async fn os_delete_member(
    Path((id, member)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    delete_image_member(&cfg, &id, &member).await?;
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

macro_rules! inst_ok {
    ($id:expr, $action:expr, $f:expr) => {{
        let cfg = openstack_cfg();
        ensure_openstack_enabled(&cfg)?;
        $f(&cfg, &$id).await?;
        log_audit($action, &$id, "ok");
        Ok(Json(serde_json::json!({ "status": "ok", "id": $id })))
    }};
}

async fn os_shelve(Path(id): Path<String>) -> Result<Json<serde_json::Value>, AppError> {
    inst_ok!(id, "openstack.instance.shelve", shelve_instance)
}

async fn os_unshelve(Path(id): Path<String>) -> Result<Json<serde_json::Value>, AppError> {
    inst_ok!(id, "openstack.instance.unshelve", unshelve_instance)
}

async fn os_migrate(
    Path(id): Path<String>,
    Json(req): Json<MigrateInstanceRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    migrate_instance(&cfg, &id, &req).await?;
    Ok(Json(serde_json::json!({ "status": "ok", "id": id })))
}

async fn os_rescue(
    Path(id): Path<String>,
    Json(req): Json<RescueInstanceRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    rescue_instance(&cfg, &id, &req).await?;
    Ok(Json(serde_json::json!({ "status": "ok", "id": id })))
}

async fn os_unrescue(Path(id): Path<String>) -> Result<Json<serde_json::Value>, AppError> {
    inst_ok!(id, "openstack.instance.unrescue", unrescue_instance)
}

async fn os_backup(
    Path(id): Path<String>,
    Json(req): Json<BackupInstanceRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    backup_instance(&cfg, &id, &req).await?;
    Ok(Json(serde_json::json!({ "status": "ok", "id": id })))
}

async fn os_list_if(Path(id): Path<String>) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    Ok(Json(
        serde_json::json!({ "interfaces": list_instance_interfaces(&cfg, &id).await? }),
    ))
}

async fn os_attach_if(
    Path(id): Path<String>,
    Json(req): Json<AttachInterfaceRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let iface = attach_interface(&cfg, &id, &req).await?;
    Ok(Json(serde_json::json!({ "interface": iface })))
}

async fn os_detach_if(Path((id, port)): Path<(String, String)>) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    detach_interface(&cfg, &id, &port).await?;
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

async fn os_stack_hint(Path(id): Path<String>) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let stack = instance_stack_hint(&cfg, &id).await?;
    Ok(Json(serde_json::json!({ "stack": stack })))
}

async fn os_console_tunnel(
    Path(id): Path<String>,
    Query(q): Query<ConsoleQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let cfg = openstack_cfg();
    ensure_openstack_enabled(&cfg)?;
    let (url, proxy_path) = remote_console_with_tunnel(&cfg, &id, &q.r#type).await?;
    Ok(Json(serde_json::json!({
        "console_type": q.r#type,
        "url": url,
        "proxy_path": proxy_path,
        "tunnel": true
    })))
}

async fn os_console_proxy(Path(token): Path<String>) -> Result<Response, AppError> {
    let target = resolve_console_token(&token).ok_or_else(|| {
        machina_core::LibvirtError::NotFound("console token expired or invalid".into())
    })?;
    let client = Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| AppError::from(machina_core::LibvirtError::Internal(e.to_string())))?;
    let resp = client
        .get(&target)
        .send()
        .await
        .map_err(|e| AppError::from(machina_core::LibvirtError::Operation(e.to_string())))?;
    let status = StatusCode::from_u16(resp.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    let ct = resp
        .headers()
        .get(header::CONTENT_TYPE)
        .cloned();
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| AppError::from(machina_core::LibvirtError::Operation(e.to_string())))?;
    let mut out = Response::builder().status(status);
    if let Some(ct) = ct {
        out = out.header(header::CONTENT_TYPE, ct);
    }
    Ok(out
        .body(Body::from(bytes))
        .unwrap_or_else(|_| (StatusCode::INTERNAL_SERVER_ERROR).into_response()))
}
