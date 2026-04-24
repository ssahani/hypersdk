use axum::extract::{Path, State};
use axum::routing::{delete, get, post};
use axum::{Json, Router};

use machina_core::libvirt::storage;
use machina_core::{CreateVolumeRequest, LibvirtError, LibvirtManager, StoragePoolInfo, StorageVolumeInfo};

use crate::error::{ok_json, AppError};

async fn list_pools(
    State(manager): State<LibvirtManager>,
) -> Result<Json<Vec<StoragePoolInfo>>, AppError> {
    let result = tokio::task::spawn_blocking(move || manager.with_conn(storage::list_pools))
        .await
        .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?;
    Ok(Json(result?))
}

async fn list_volumes(
    State(manager): State<LibvirtManager>,
    Path(pool_name): Path<String>,
) -> Result<Json<Vec<StorageVolumeInfo>>, AppError> {
    let result = tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| storage::list_volumes(conn, &pool_name))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?;
    Ok(Json(result?))
}

async fn start_pool(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| storage::start_pool(conn, &name2))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
    ?;
    Ok(ok_json("started", &name))
}

async fn stop_pool(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| storage::stop_pool(conn, &name2))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
    ?;
    Ok(ok_json("stopped", &name))
}

async fn refresh_pool(
    State(manager): State<LibvirtManager>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| storage::refresh_pool(conn, &name2))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
    ?;
    Ok(ok_json("refreshed", &name))
}

async fn set_pool_autostart(
    State(manager): State<LibvirtManager>,
    Path((name, enabled)): Path<(String, bool)>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name2 = name.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| storage::set_pool_autostart(conn, &name2, enabled))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
    ?;
    let label = if enabled { "enabled" } else { "disabled" };
    Ok(ok_json(label, &name))
}

async fn delete_volume(
    State(manager): State<LibvirtManager>,
    Path((pool_name, vol_name)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, AppError> {
    let pool2 = pool_name.clone();
    let vol2 = vol_name.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| storage::delete_volume(conn, &pool2, &vol2))
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
    ?;
    Ok(Json(serde_json::json!({ "status": "deleted", "pool": pool_name, "volume": vol_name })))
}

async fn create_volume(
    State(manager): State<LibvirtManager>,
    Path(pool_name): Path<String>,
    Json(req): Json<CreateVolumeRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let vol_name = req.name.clone();
    let pool2 = pool_name.clone();
    tokio::task::spawn_blocking(move || {
        manager.with_conn(|conn| {
            storage::create_volume(conn, &pool2, &req.name, req.capacity_gb, &req.format)
        })
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))?
    ?;
    Ok(Json(serde_json::json!({ "status": "created", "pool": pool_name, "volume": vol_name })))
}

pub fn storage_routes() -> Router<LibvirtManager> {
    Router::new()
        .route("/storage/pools", get(list_pools))
        .route("/storage/pools/{name}/start", post(start_pool))
        .route("/storage/pools/{name}/stop", post(stop_pool))
        .route("/storage/pools/{name}/refresh", post(refresh_pool))
        .route("/storage/pools/{name}/autostart/{enabled}", post(set_pool_autostart))
        .route("/storage/pools/{pool_name}/volumes", get(list_volumes))
        .route("/storage/pools/{pool_name}/volumes", post(create_volume))
        .route(
            "/storage/pools/{pool_name}/volumes/{vol_name}",
            delete(delete_volume),
        )
}
