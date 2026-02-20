use axum::extract::{Path, State};
use axum::routing::get;
use axum::{Json, Router};

use virtspawn_core::libvirt::metrics;
use virtspawn_core::{LibvirtManager, VmMetrics};

use crate::error::AppError;

async fn get_all_metrics(
    State(manager): State<LibvirtManager>,
) -> Result<Json<Vec<VmMetrics>>, AppError> {
    let m = manager.with_conn(metrics::get_all_vm_metrics)?;
    Ok(Json(m))
}

async fn get_vm_metrics(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<VmMetrics>, AppError> {
    let m = manager.with_conn(|conn| metrics::get_vm_metrics(conn, &name))?;
    Ok(Json(m))
}

pub fn metrics_routes() -> Router<LibvirtManager> {
    Router::new()
        .route("/metrics", get(get_all_metrics))
        .route("/metrics/{name}", get(get_vm_metrics))
}
