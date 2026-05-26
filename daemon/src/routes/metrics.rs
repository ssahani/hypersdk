use axum::extract::{Extension, Path, Query, State};
use axum::routing::get;
use axum::{Json, Router};

use machina_core::libvirt::metrics;
use machina_core::{LibvirtError, LibvirtManager, VmMetrics};

use crate::conn_query::ConnQuery;
use crate::error::AppError;
use crate::metrics_history::MetricsHistoryStore;

async fn get_all_metrics(
    State(manager): State<LibvirtManager>,
) -> Result<Json<Vec<VmMetrics>>, AppError> {
    let result = tokio::task::spawn_blocking(move || manager.merge_all_metrics())
        .await
        .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?;
    Ok(Json(result?))
}

async fn get_vm_metrics(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
    Query(q): Query<ConnQuery>,
) -> Result<Json<VmMetrics>, AppError> {
    let dual = manager.dual_enabled();
    let target = manager.resolve_query(q.connection.as_deref());
    let mgr = manager.clone();
    let name2 = name.clone();
    let mut m = tokio::task::spawn_blocking(move || {
        mgr.with_conn_target(target, |conn| metrics::get_vm_metrics(conn, &name2))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))??;
    m.libvirt_connection = crate::conn_query::connection_label(dual, target);
    Ok(Json(m))
}

#[derive(serde::Deserialize)]
struct HistoryQuery {
    limit: Option<usize>,
}

async fn get_metrics_history(
    Extension(store): Extension<MetricsHistoryStore>,
    Query(q): Query<HistoryQuery>,
) -> Json<serde_json::Value> {
    let limit = q.limit.unwrap_or(60).min(500);
    let points = store.snapshot(limit);
    Json(serde_json::json!({
        "points": points,
        "persist_path": machina_core::metrics_history::metrics_history_jsonl_path().to_string_lossy(),
    }))
}

pub fn metrics_routes() -> Router<LibvirtManager> {
    Router::new()
        .route("/metrics", get(get_all_metrics))
        .route("/metrics/history", get(get_metrics_history))
        .route("/metrics/{name}", get(get_vm_metrics))
}
