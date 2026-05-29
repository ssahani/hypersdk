// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::extract::{Query, State};
use axum::Json;
use serde::Serialize;
use uuid::Uuid;

use crate::api::ApiError;
use crate::state::AppState;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct EventRow {
    pub id: Uuid,
    pub kind: String,
    pub message: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, serde::Deserialize)]
pub struct EventQuery {
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    200
}

pub async fn list_events(
    State(state): State<AppState>,
    Query(q): Query<EventQuery>,
) -> Result<Json<Vec<EventRow>>, ApiError> {
    let limit = q.limit.clamp(1, 500);
    let rows = if let Some(kind) = q.kind.filter(|k| !k.is_empty()) {
        sqlx::query_as::<_, EventRow>(
            "SELECT id, kind, message, created_at FROM events
             WHERE kind LIKE $1 ORDER BY created_at DESC LIMIT $2",
        )
        .bind(format!("%{kind}%"))
        .bind(limit)
        .fetch_all(&state.pool)
        .await?
    } else {
        sqlx::query_as::<_, EventRow>(
            "SELECT id, kind, message, created_at FROM events ORDER BY created_at DESC LIMIT $1",
        )
        .bind(limit)
        .fetch_all(&state.pool)
        .await?
    };
    Ok(Json(rows))
}
