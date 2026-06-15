// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::extract::State;
use axum::Extension;
use axum::Json;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api::ApiError;
use crate::auth::{require_operator, AuthUser};
use crate::state::AppState;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct BackupTargetRow {
    pub id: Uuid,
    pub name: String,
    pub kind: String,
    pub config_json: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct CreateBackupTargetBody {
    pub name: String,
    #[serde(default = "default_kind")]
    pub kind: String,
    #[serde(default)]
    pub config_json: serde_json::Value,
}

fn default_kind() -> String {
    "local".into()
}

pub async fn list_backup_targets(
    State(state): State<AppState>,
) -> Result<Json<Vec<BackupTargetRow>>, ApiError> {
    let rows = sqlx::query_as::<_, BackupTargetRow>(
        "SELECT id, name, kind, config_json FROM backup_targets ORDER BY name",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

pub async fn create_backup_target(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
    Json(body): Json<CreateBackupTargetBody>,
) -> Result<Json<BackupTargetRow>, ApiError> {
    require_operator(&actor)?;
    machina_spec::validate_name(&body.name).map_err(|e| ApiError::bad_request(e.to_string()))?;
    let id = Uuid::new_v4();
    sqlx::query("INSERT INTO backup_targets (id, name, kind, config_json) VALUES ($1, $2, $3, $4)")
        .bind(id)
        .bind(&body.name)
        .bind(&body.kind)
        .bind(&body.config_json)
        .execute(&state.pool)
        .await?;
    let row = sqlx::query_as::<_, BackupTargetRow>(
        "SELECT id, name, kind, config_json FROM backup_targets WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await?;
    Ok(Json(row))
}
