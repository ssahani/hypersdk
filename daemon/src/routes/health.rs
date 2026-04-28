use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};

use machina_core::{host_virt, LibvirtManager};

async fn health_check(State(manager): State<LibvirtManager>) -> impl IntoResponse {
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

async fn host_virtualization() -> Json<serde_json::Value> {
    Json(
        serde_json::to_value(host_virt::virtualization_status()).unwrap_or_else(|_| {
            serde_json::json!({ "error": "serialization_failed" })
        }),
    )
}

async fn libvirt_summary(State(manager): State<LibvirtManager>) -> Json<serde_json::Value> {
    Json(manager.api_connection_summary())
}

pub fn health_routes() -> Router<LibvirtManager> {
    Router::new()
        .route("/health", get(health_check))
        .route("/host/virtualization", get(host_virtualization))
        .route("/libvirt/summary", get(libvirt_summary))
}
