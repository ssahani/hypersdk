// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

//! `POST/GET/DELETE /v1/sprites` — instant, disposable microVM sandboxes.
//!
//! Deliberately outside `vms.rs`: sprites don't go through
//! `create::create_vm()` (see `machina_core::libvirt::sprite`'s module doc
//! for why), aren't tracked in any database, and have their own TTL-based
//! reaper instead of the controller's desired-state reconciler. See the
//! sprites design doc for the full rationale.

use std::sync::Arc;

use axum::extract::{Extension, Path, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use virt::connect::Connect;

use machina_core::libvirt::sprite::{boot_sprite, resolve_golden_image, SpriteBootRequest};
use machina_core::{audit, AuditEvent, LibvirtError, LibvirtManager};
use machina_spec::{sprite_domain_name, SpriteCreateRequest, SpriteHandle};

use crate::auth::{require_write, RequestActor};
use crate::error::{ok_json, AppError};
use crate::sprite_registry::{teardown_sprite, SpriteRegistry};

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

async fn create_sprite(
    State(manager): State<LibvirtManager>,
    Extension(actor): Extension<RequestActor>,
    Extension(registry): Extension<Arc<SpriteRegistry>>,
    Json(req): Json<SpriteCreateRequest>,
) -> Result<Json<SpriteHandle>, AppError> {
    require_write(&actor, "sprites:write")?;
    req.validate()
        .map_err(|e| AppError::from(LibvirtError::Invalid(e.to_string())))?;

    let sprite_id = uuid::Uuid::new_v4().to_string();
    let domain_name = sprite_domain_name(&sprite_id);
    let golden_image = req.golden_image.clone();
    let vcpus = req.vcpus;
    let memory_mb = req.memory_mb;

    // Dedicated connection, not manager.with_conn(): mirrors
    // create_vm_handler's own reasoning in vms.rs — don't hold the daemon's
    // single shared libvirt mutex for anything that isn't guaranteed-instant,
    // which matters even more here since concurrent sprite bursts are the
    // whole point of this path (serializing them through one mutex would
    // directly undermine "instant").
    let libvirt_uri = manager.virt_uri_for_target(manager.default_target());
    let domain_name_for_boot = domain_name.clone();
    let boot_result = tokio::task::spawn_blocking(move || -> Result<_, LibvirtError> {
        let conn = Connect::open(Some(&libvirt_uri)).map_err(|e| {
            LibvirtError::Connection(format!("Failed to connect to libvirt ({libvirt_uri}): {e}"))
        })?;
        let golden_image_path = resolve_golden_image(&golden_image)?;
        boot_sprite(
            &conn,
            &SpriteBootRequest {
                domain_name: &domain_name_for_boot,
                golden_image_path: &golden_image_path,
                vcpus,
                memory_mb,
            },
        )
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))));

    let boot_result = match boot_result {
        Ok(Ok(r)) => r,
        Ok(Err(e)) => {
            log_audit(
                "sprite_create",
                &domain_name,
                &format!("fail: {e}").chars().take(500).collect::<String>(),
            );
            return Err(AppError::from(e));
        }
        Err(e) => {
            log_audit("sprite_create", &domain_name, "fail: task join error");
            return Err(e);
        }
    };

    let handle = registry
        .register(
            sprite_id.clone(),
            domain_name.clone(),
            req.ttl_seconds,
            boot_result.vsock_cid,
        )
        .map_err(|e| AppError::from(LibvirtError::Internal(e.into())))?;

    log_audit("sprite_create", &domain_name, "ok");
    Ok(Json(handle))
}

async fn list_sprites(Extension(registry): Extension<Arc<SpriteRegistry>>) -> Json<Vec<SpriteHandle>> {
    Json(registry.list())
}

async fn get_sprite(
    Extension(registry): Extension<Arc<SpriteRegistry>>,
    Path(id): Path<String>,
) -> Result<Json<SpriteHandle>, AppError> {
    registry
        .get(&id)
        .map(Json)
        .ok_or_else(|| AppError::from(LibvirtError::NotFound(format!("sprite '{id}' not found"))))
}

async fn delete_sprite(
    State(manager): State<LibvirtManager>,
    Extension(actor): Extension<RequestActor>,
    Extension(registry): Extension<Arc<SpriteRegistry>>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_write(&actor, "sprites:write")?;
    let Some(domain_name) = registry.remove(&id) else {
        return Err(AppError::from(LibvirtError::NotFound(format!(
            "sprite '{id}' not found"
        ))));
    };
    match teardown_sprite(&manager, domain_name.clone()).await {
        Ok(()) => {
            log_audit("sprite_delete", &domain_name, "ok");
            Ok(ok_json("deleted", &id))
        }
        Err(e) => {
            log_audit("sprite_delete", &domain_name, &format!("fail: {e}"));
            Err(AppError::from(LibvirtError::Operation(e)))
        }
    }
}

pub fn sprite_routes() -> Router<LibvirtManager> {
    Router::new()
        .route("/sprites", post(create_sprite).get(list_sprites))
        .route("/sprites/{id}", get(get_sprite).delete(delete_sprite))
}
