use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};

use virtspawn_core::LibvirtManager;

use crate::error::AppError;

async fn health_check(
    State(manager): State<LibvirtManager>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Verify libvirt connection is alive
    let alive = manager
        .with_conn(|conn| {
            conn.get_hostname()
                .map_err(|e| virtspawn_core::LibvirtError::Connection(e.to_string()))
        })
        .is_ok();

    Ok(Json(serde_json::json!({
        "status": if alive { "healthy" } else { "unhealthy" },
        "libvirt": alive,
    })))
}

pub fn health_routes() -> Router<LibvirtManager> {
    Router::new().route("/health", get(health_check))
}
