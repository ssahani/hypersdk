// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::extract::{Path, State};
use axum::Extension;
use axum::Json;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api::ApiError;
use crate::auth::AuthUser;
use crate::state::AppState;
use crate::tasks::enqueue::enqueue_task;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct StoragePoolRow {
    pub id: Uuid,
    pub name: String,
    pub storage_class: String,
    pub backend: String,
    pub path: Option<String>,
    pub capacity_gib: i64,
    pub used_gib: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateStoragePoolBody {
    pub name: String,
    #[serde(default = "default_class")]
    pub storage_class: String,
    #[serde(default = "default_backend")]
    pub backend: String,
    pub path: Option<String>,
    #[serde(default)]
    pub capacity_gib: i64,
    #[serde(default)]
    pub host_id: Option<Uuid>,
}

fn default_class() -> String {
    "silver".into()
}
fn default_backend() -> String {
    "directory".into()
}

pub async fn discover_storage_pools(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let imported = crate::engine::storage_sync::discover_all_online(&state.pool)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))?;
    let rows = sqlx::query_as::<_, StoragePoolRow>(
        "SELECT id, name, storage_class, backend, path, capacity_gib, used_gib
         FROM storage_pools ORDER BY name",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(serde_json::json!({
        "imported": imported,
        "pools": rows,
    })))
}

pub async fn list_storage_pools(
    State(state): State<AppState>,
) -> Result<Json<Vec<StoragePoolRow>>, ApiError> {
    let rows = sqlx::query_as::<_, StoragePoolRow>(
        "SELECT id, name, storage_class, backend, path, capacity_gib, used_gib
         FROM storage_pools ORDER BY name",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

pub async fn create_storage_pool(
    State(state): State<AppState>,
    Extension(_actor): Extension<AuthUser>,
    Json(body): Json<CreateStoragePoolBody>,
) -> Result<Json<StoragePoolRow>, ApiError> {
    machina_spec::validate_name(&body.name).map_err(|e| ApiError::bad_request(e.to_string()))?;
    let cluster_id: Uuid = sqlx::query_scalar("SELECT id FROM clusters LIMIT 1")
        .fetch_one(&state.pool)
        .await?;
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO storage_pools (id, cluster_id, name, storage_class, backend, path, capacity_gib)
         VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(id)
    .bind(cluster_id)
    .bind(&body.name)
    .bind(&body.storage_class)
    .bind(&body.backend)
    .bind(&body.path)
    .bind(body.capacity_gib)
    .execute(&state.pool)
    .await?;

    let row = sqlx::query_as::<_, StoragePoolRow>(
        "SELECT id, name, storage_class, backend, path, capacity_gib, used_gib FROM storage_pools WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await?;

    if body.path.is_some() {
        let host_id = match body.host_id {
            Some(h) => h,
            None => sqlx::query_scalar("SELECT id FROM hosts WHERE state = 'online' ORDER BY hostname LIMIT 1")
                .fetch_optional(&state.pool)
                .await?
                .ok_or_else(|| ApiError::bad_request("no online host for storage provisioning"))?,
        };
        let _ = enqueue_task(
            &state,
            "storage.pool.provision",
            serde_json::json!({
                "pool_id": id.to_string(),
                "host_id": host_id.to_string(),
            }),
            Some("storage_pool"),
            Some(id),
            Some(host_id),
        )
        .await?;
    }

    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct PatchStoragePoolBody {
    pub path: Option<String>,
    pub capacity_gib: Option<i64>,
    pub used_gib: Option<i64>,
}

pub async fn patch_storage_pool(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<PatchStoragePoolBody>,
) -> Result<Json<StoragePoolRow>, ApiError> {
    if let Some(v) = &body.path {
        sqlx::query("UPDATE storage_pools SET path = $1 WHERE id = $2")
            .bind(v)
            .bind(id)
            .execute(&state.pool)
            .await?;
    }
    if let Some(v) = body.capacity_gib {
        sqlx::query("UPDATE storage_pools SET capacity_gib = $1 WHERE id = $2")
            .bind(v)
            .bind(id)
            .execute(&state.pool)
            .await?;
    }
    if let Some(v) = body.used_gib {
        sqlx::query("UPDATE storage_pools SET used_gib = $1 WHERE id = $2")
            .bind(v)
            .bind(id)
            .execute(&state.pool)
            .await?;
    }
    let row = sqlx::query_as::<_, StoragePoolRow>(
        "SELECT id, name, storage_class, backend, path, capacity_gib, used_gib FROM storage_pools WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await?;
    Ok(Json(row))
}

pub async fn delete_storage_pool(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    sqlx::query("DELETE FROM storage_pools WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}
