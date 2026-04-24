use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};

use machina_core::LibvirtManager;

async fn health_check(
    State(manager): State<LibvirtManager>,
) -> impl IntoResponse {
    let alive = tokio::task::spawn_blocking(move || {
        manager
            .with_conn(|conn| {
                conn.get_hostname()
                    .map_err(|e| machina_core::LibvirtError::Connection(e.to_string()))
            })
            .is_ok()
    })
    .await
    .unwrap_or(false);

    let status = if alive {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    (
        status,
        Json(serde_json::json!({
            "status": if alive { "healthy" } else { "unhealthy" },
            "libvirt": alive,
        })),
    )
}

pub fn health_routes() -> Router<LibvirtManager> {
    Router::new().route("/health", get(health_check))
}
