use axum::extract::Extension;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use tracing::info;
use virtspawn_core::system_accounts;
use virtspawn_core::{LibvirtError, LibvirtManager};

use crate::auth::RequestActor;
use crate::error::AppError;

async fn os_users_capability(
    Extension(actor): Extension<RequestActor>,
) -> Json<serde_json::Value> {
    if actor.from_api_token {
        return Json(serde_json::json!({
            "canCreateOsUsers": false,
            "reason": "API tokens cannot create system users"
        }));
    }
    let ok = system_accounts::unix_user_may_use_sudo(&actor.username);
    Json(serde_json::json!({
        "canCreateOsUsers": ok,
        "reason": if ok {
            serde_json::Value::Null
        } else {
            serde_json::json!("Signed-in user is not in wheel, sudo, or admin (required to create accounts)")
        }
    }))
}

#[derive(Deserialize)]
struct CreateOsUserRequest {
    username: String,
    password: String,
}

async fn create_os_user(
    Extension(actor): Extension<RequestActor>,
    Json(req): Json<CreateOsUserRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    if actor.from_api_token {
        return Err(
            LibvirtError::Forbidden("API tokens cannot create system users".into()).into(),
        );
    }
    if !system_accounts::unix_user_may_use_sudo(&actor.username) {
        return Err(LibvirtError::Forbidden(
            "Only users in wheel, sudo, or admin may create system accounts".into(),
        )
        .into());
    }
    system_accounts::create_local_user(&req.username, &req.password)?;
    info!(
        "OS user '{}' created via virtspawn by session user '{}'",
        req.username, actor.username
    );
    Ok(Json(serde_json::json!({ "status": "ok", "username": req.username })))
}

pub fn system_routes() -> Router<LibvirtManager> {
    Router::new()
        .route("/system/os-users/capability", get(os_users_capability))
        .route("/system/os-users", post(create_os_user))
}
