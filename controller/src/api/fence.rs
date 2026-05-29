// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::extract::State;
use axum::Json;
use serde::Serialize;
use uuid::Uuid;

use crate::api::ApiError;
use crate::state::AppState;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FenceEventRow {
    pub id: Uuid,
    pub host_id: Uuid,
    pub action: String,
    pub success: bool,
    pub message: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub async fn list_fence_events(
    State(state): State<AppState>,
) -> Result<Json<Vec<FenceEventRow>>, ApiError> {
    let rows = sqlx::query_as::<_, FenceEventRow>(
        "SELECT id, host_id, action, success, message, created_at
         FROM fence_events ORDER BY created_at DESC LIMIT 100",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}
