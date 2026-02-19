use axum::extract::{Path, State};
use axum::routing::{delete, get};
use axum::{Json, Router};

use virtspawn_core::libvirt::storage;
use virtspawn_core::{LibvirtManager, StoragePoolInfo, StorageVolumeInfo};

use crate::error::AppError;

async fn list_pools(
    State(manager): State<LibvirtManager>,
) -> Result<Json<Vec<StoragePoolInfo>>, AppError> {
    let pools = manager.with_conn(|conn| storage::list_pools(conn))?;
    Ok(Json(pools))
}

async fn list_volumes(
    State(manager): State<LibvirtManager>,
    Path(pool_name): Path<String>,
) -> Result<Json<Vec<StorageVolumeInfo>>, AppError> {
    let vols = manager.with_conn(|conn| storage::list_volumes(conn, &pool_name))?;
    Ok(Json(vols))
}

async fn delete_volume(
    State(manager): State<LibvirtManager>,
    Path((pool_name, vol_name)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| storage::delete_volume(conn, &pool_name, &vol_name))?;
    Ok(Json(serde_json::json!({ "status": "deleted", "pool": pool_name, "volume": vol_name })))
}

pub fn storage_routes() -> Router<LibvirtManager> {
    Router::new()
        .route("/storage/pools", get(list_pools))
        .route("/storage/pools/{pool_name}/volumes", get(list_volumes))
        .route(
            "/storage/pools/{pool_name}/volumes/{vol_name}",
            delete(delete_volume),
        )
}
