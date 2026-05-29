// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::extract::{Path, State};
use axum::Json;
use serde::Serialize;
use uuid::Uuid;

use crate::api::ApiError;
use crate::state::AppState;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MigrationJobRow {
    pub id: Uuid,
    pub vm_id: Uuid,
    pub source_host_id: Uuid,
    pub dest_host_id: Uuid,
    pub live: bool,
    pub status: String,
    pub progress: i16,
    pub message: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub async fn list_migration_jobs(
    State(state): State<AppState>,
) -> Result<Json<Vec<MigrationJobRow>>, ApiError> {
    let rows = sqlx::query_as::<_, MigrationJobRow>(
        "SELECT id, vm_id, source_host_id, dest_host_id, live, status, progress, message, created_at
         FROM migration_jobs ORDER BY created_at DESC LIMIT 100",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

pub async fn list_vm_migration_jobs(
    State(state): State<AppState>,
    Path(vm_id): Path<Uuid>,
) -> Result<Json<Vec<MigrationJobRow>>, ApiError> {
    let rows = sqlx::query_as::<_, MigrationJobRow>(
        "SELECT id, vm_id, source_host_id, dest_host_id, live, status, progress, message, created_at
         FROM migration_jobs WHERE vm_id = $1 ORDER BY created_at DESC LIMIT 50",
    )
    .bind(vm_id)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}
