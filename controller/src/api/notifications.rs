// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Serialize;
use uuid::Uuid;

use crate::api::ApiError;
use crate::state::AppState;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct NotificationRow {
    pub id: Uuid,
    pub kind: String,
    pub payload: serde_json::Value,
    pub delivered: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub delivered_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, serde::Deserialize)]
pub struct NotificationQuery {
    #[serde(default)]
    pub undelivered: bool,
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    100
}

pub async fn list_notifications(
    State(state): State<AppState>,
    Query(q): Query<NotificationQuery>,
) -> Result<Json<Vec<NotificationRow>>, ApiError> {
    let limit = q.limit.clamp(1, 500);
    let rows = if q.undelivered {
        sqlx::query_as::<_, NotificationRow>(
            "SELECT id, kind, payload, delivered, created_at, delivered_at
             FROM notification_outbox WHERE delivered = FALSE ORDER BY created_at DESC LIMIT $1",
        )
        .bind(limit)
        .fetch_all(&state.pool)
        .await?
    } else {
        sqlx::query_as::<_, NotificationRow>(
            "SELECT id, kind, payload, delivered, created_at, delivered_at
             FROM notification_outbox ORDER BY created_at DESC LIMIT $1",
        )
        .bind(limit)
        .fetch_all(&state.pool)
        .await?
    };
    Ok(Json(rows))
}

pub async fn mark_notification_delivered(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    sqlx::query(
        "UPDATE notification_outbox SET delivered = TRUE, delivered_at = NOW() WHERE id = $1",
    )
    .bind(id)
    .execute(&state.pool)
    .await?;
    Ok(Json(serde_json::json!({ "delivered": true })))
}
