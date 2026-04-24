use axum::extract::{Path, State};
use axum::routing::get;
use axum::{Json, Router};

use machina_core::libvirt::metrics;
use machina_core::{LibvirtError, LibvirtManager, VmMetrics};

use crate::error::AppError;

async fn get_all_metrics(
    State(manager): State<LibvirtManager>,
) -> Result<Json<Vec<VmMetrics>>, AppError> {
    let result = tokio::task::spawn_blocking(move || {
        manager.with_conn(metrics::get_all_vm_metrics)
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?;
    Ok(Json(result?))
}

async fn get_vm_metrics(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<VmMetrics>, AppError> {
    let result = tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| metrics::get_vm_metrics(conn, &name))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?;
    Ok(Json(result?))
}

pub fn metrics_routes() -> Router<LibvirtManager> {
    Router::new()
        .route("/metrics", get(get_all_metrics))
        .route("/metrics/{name}", get(get_vm_metrics))
}
