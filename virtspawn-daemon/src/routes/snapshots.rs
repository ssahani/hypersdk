use axum::extract::{Path, State};
use axum::routing::{delete, get, post};
use axum::{Json, Router};

use virtspawn_core::libvirt::snapshot;
use virtspawn_core::{CreateSnapshotRequest, LibvirtManager, SnapshotInfo};

use crate::error::AppError;

async fn list_all_snapshots(
    State(manager): State<LibvirtManager>,
) -> Result<Json<Vec<SnapshotInfo>>, AppError> {
    let snaps = manager.with_conn(|conn| snapshot::list_all_snapshots(conn))?;
    Ok(Json(snaps))
}

async fn list_vm_snapshots(
    State(manager): State<LibvirtManager>,
    Path(vm_name): Path<String>,
) -> Result<Json<Vec<SnapshotInfo>>, AppError> {
    let snaps = manager.with_conn(|conn| snapshot::list_snapshots(conn, &vm_name))?;
    Ok(Json(snaps))
}

async fn create_snapshot_handler(
    State(manager): State<LibvirtManager>,
    Path(vm_name): Path<String>,
    Json(req): Json<CreateSnapshotRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| snapshot::create_snapshot(conn, &vm_name, &req.name, &req.description))?;
    Ok(Json(serde_json::json!({ "status": "created", "vm": vm_name, "snapshot": req.name })))
}

async fn delete_snapshot_handler(
    State(manager): State<LibvirtManager>,
    Path((vm_name, snap_name)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| snapshot::delete_snapshot(conn, &vm_name, &snap_name))?;
    Ok(Json(serde_json::json!({ "status": "deleted", "vm": vm_name, "snapshot": snap_name })))
}

async fn revert_snapshot_handler(
    State(manager): State<LibvirtManager>,
    Path((vm_name, snap_name)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, AppError> {
    manager.with_conn(|conn| snapshot::revert_snapshot(conn, &vm_name, &snap_name))?;
    Ok(Json(serde_json::json!({ "status": "reverted", "vm": vm_name, "snapshot": snap_name })))
}

pub fn snapshot_routes() -> Router<LibvirtManager> {
    Router::new()
        .route("/snapshots", get(list_all_snapshots))
        .route("/vms/{vm_name}/snapshots", get(list_vm_snapshots))
        .route("/vms/{vm_name}/snapshots", post(create_snapshot_handler))
        .route(
            "/vms/{vm_name}/snapshots/{snap_name}",
            delete(delete_snapshot_handler),
        )
        .route(
            "/vms/{vm_name}/snapshots/{snap_name}/revert",
            post(revert_snapshot_handler),
        )
}
