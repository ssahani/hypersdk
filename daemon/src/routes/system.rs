use axum::extract::{Extension, Path};
use axum::routing::{delete, get, post, put};
use axum::{Json, Router};
use machina_core::system_accounts;
use machina_core::{LibvirtError, LibvirtManager};
use serde::Deserialize;
use serde_json::json;
use tracing::info;

use crate::auth::RequestActor;
use crate::error::AppError;

fn os_user_capability_json(actor: &RequestActor) -> serde_json::Value {
    let libvirt_ok = system_accounts::libvirt_unix_group_exists();
    let backend = system_accounts::os_user_account_backend();
    let homed_active = system_accounts::systemd_homed_is_active();
    let homectl_ok = system_accounts::homectl_available();
    let sudo_g = system_accounts::sudo_supplementary_group();

    if actor.from_api_token {
        return serde_json::json!({
            "canCreateOsUsers": false,
            "canDeleteOsUsers": false,
            "reason": "API tokens cannot create or delete system users",
            "libvirtGroupAvailable": libvirt_ok,
            "libvirtGroupName": system_accounts::LIBVIRT_UNIX_GROUP,
            "userAccountBackend": backend,
            "systemdHomedActive": homed_active,
            "homectlAvailable": homectl_ok,
            "sudoSupplementaryGroup": sudo_g,
        });
    }
    let ok = system_accounts::unix_user_may_use_sudo(&actor.username);
    serde_json::json!({
        "canCreateOsUsers": ok,
        "canDeleteOsUsers": ok,
        "reason": if ok {
            serde_json::Value::Null
        } else {
            serde_json::json!("Signed-in user is not in wheel, sudo, or admin (required to create or delete accounts)")
        },
        "libvirtGroupAvailable": libvirt_ok,
        "libvirtGroupName": system_accounts::LIBVIRT_UNIX_GROUP,
        "userAccountBackend": backend,
        "systemdHomedActive": homed_active,
        "homectlAvailable": homectl_ok,
        "sudoSupplementaryGroup": sudo_g,
    })
}

async fn os_users_capability(Extension(actor): Extension<RequestActor>) -> Json<serde_json::Value> {
    Json(os_user_capability_json(&actor))
}

fn default_true() -> bool {
    true
}

#[derive(Deserialize)]
struct CreateOsUserRequest {
    username: String,
    password: String,
    /// Append new user to host `libvirt` group (`qemu:///system`). Default: true.
    #[serde(default = "default_true")]
    add_to_libvirt_group: bool,
}

async fn create_os_user(
    Extension(actor): Extension<RequestActor>,
    Json(req): Json<CreateOsUserRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    if actor.from_api_token {
        return Err(LibvirtError::Forbidden("API tokens cannot create system users".into()).into());
    }
    if !system_accounts::unix_user_may_use_sudo(&actor.username) {
        return Err(LibvirtError::Forbidden(
            "Only users in wheel, sudo, or admin may create system accounts".into(),
        )
        .into());
    }
    let outcome =
        system_accounts::create_local_user(&req.username, &req.password, req.add_to_libvirt_group)?;
    info!(
        "OS user '{}' created via machina by session user '{}' (libvirt group: {})",
        req.username, actor.username, outcome.libvirt_group_attached
    );
    Ok(Json(serde_json::json!({
        "status": "ok",
        "username": req.username,
        "libvirt_group_attached": outcome.libvirt_group_attached,
        "account_backend": system_accounts::os_user_account_backend(),
    })))
}

async fn delete_os_user(
    Extension(actor): Extension<RequestActor>,
    Path(username): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    if actor.from_api_token {
        return Err(LibvirtError::Forbidden("API tokens cannot delete system users".into()).into());
    }
    if !system_accounts::unix_user_may_use_sudo(&actor.username) {
        return Err(LibvirtError::Forbidden(
            "Only users in wheel, sudo, or admin may delete system accounts".into(),
        )
        .into());
    }
    if username == actor.username {
        return Err(
            LibvirtError::Forbidden("Cannot delete the signed-in UNIX account".into()).into(),
        );
    }
    system_accounts::delete_local_user(&username)?;
    info!(
        "OS user '{}' removed via machina by session user '{}'",
        username, actor.username,
    );
    Ok(Json(serde_json::json!({
        "status": "ok",
        "username": username,
    })))
}

const CREATE_VM_DEFAULTS_PATH: &str = "/var/lib/machina/create-vm-defaults.json";

fn load_create_vm_defaults_json() -> serde_json::Value {
    std::fs::read_to_string(CREATE_VM_DEFAULTS_PATH)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or(json!({}))
}

async fn get_create_vm_defaults(
    Extension(_actor): Extension<RequestActor>,
) -> Json<serde_json::Value> {
    Json(load_create_vm_defaults_json())
}

async fn put_create_vm_defaults(
    Extension(actor): Extension<RequestActor>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, AppError> {
    if !actor.role.can_write() {
        return Err(LibvirtError::Forbidden(
            "Saving hypervisor defaults requires operator or admin.".into(),
        )
        .into());
    }
    std::fs::create_dir_all("/var/lib/machina").map_err(|e| {
        AppError::from(LibvirtError::Operation(format!("create /var/lib/machina: {e}")))
    })?;
    let data = serde_json::to_string_pretty(&body)
        .map_err(|e| AppError::from(LibvirtError::Operation(format!("serialize defaults: {e}"))))?;
    std::fs::write(CREATE_VM_DEFAULTS_PATH, data).map_err(|e| {
        AppError::from(LibvirtError::Operation(format!("write defaults: {e}")))
    })?;
    Ok(Json(json!({ "status": "saved" })))
}

pub fn system_routes() -> Router<LibvirtManager> {
    Router::new()
        .route("/system/os-users/capability", get(os_users_capability))
        .route("/system/os-users", post(create_os_user))
        .route("/system/os-users/{username}", delete(delete_os_user))
        .route(
            "/system/create-vm-defaults",
            get(get_create_vm_defaults).put(put_create_vm_defaults),
        )
}
