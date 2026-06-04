// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::extract::{Path, Query, State};
use axum::Extension;
use axum::Json;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api::ApiError;
use crate::auth::{require_admin, AuthUser};
use crate::state::AppState;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct WebhookRow {
    pub id: Uuid,
    pub url: String,
    pub events: Vec<String>,
    pub enabled: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateWebhookBody {
    pub url: String,
    pub events: Vec<String>,
    #[serde(default)]
    pub secret: String,
}

pub async fn list_webhooks(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
) -> Result<Json<Vec<WebhookRow>>, ApiError> {
    require_admin(&actor)?;
    let rows = sqlx::query_as::<_, WebhookRow>(
        "SELECT id, url, events, enabled, created_at FROM webhooks ORDER BY created_at DESC",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

pub async fn create_webhook(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
    Json(body): Json<CreateWebhookBody>,
) -> Result<Json<WebhookRow>, ApiError> {
    require_admin(&actor)?;
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO webhooks (id, url, events, secret) VALUES ($1, $2, $3, $4)",
    )
    .bind(id)
    .bind(&body.url)
    .bind(&body.events)
    .bind(&body.secret)
    .execute(&state.pool)
    .await?;
    let row = sqlx::query_as::<_, WebhookRow>(
        "SELECT id, url, events, enabled, created_at FROM webhooks WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await?;
    Ok(Json(row))
}

pub async fn delete_webhook(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    require_admin(&actor)?;
    sqlx::query("DELETE FROM webhook_deliveries WHERE webhook_id = $1")
        .bind(id)
        .execute(&state.pool)
        .await?;
    sqlx::query("DELETE FROM webhooks WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}

pub async fn toggle_webhook(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<WebhookRow>, ApiError> {
    require_admin(&actor)?;
    sqlx::query("UPDATE webhooks SET enabled = NOT enabled WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await?;
    let row = sqlx::query_as::<_, WebhookRow>(
        "SELECT id, url, events, enabled, created_at FROM webhooks WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await?;
    Ok(Json(row))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct WebhookDeliveryRow {
    pub id: Uuid,
    pub webhook_id: Option<Uuid>,
    pub url: String,
    pub event_kind: String,
    pub attempts: i32,
    pub max_attempts: i32,
    pub status: String,
    pub last_error: String,
    pub next_retry_at: chrono::DateTime<chrono::Utc>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct ListWebhookDeliveriesQuery {
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    50
}

pub async fn list_webhook_deliveries(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
    Query(q): Query<ListWebhookDeliveriesQuery>,
) -> Result<Json<Vec<WebhookDeliveryRow>>, ApiError> {
    require_admin(&actor)?;
    let limit = q.limit.clamp(1, 200);
    let rows = if let Some(status) = &q.status {
        sqlx::query_as::<_, WebhookDeliveryRow>(
            "SELECT id, webhook_id, url, event_kind, attempts, max_attempts, status, last_error,
                    next_retry_at, created_at
             FROM webhook_deliveries WHERE status = $1
             ORDER BY created_at DESC LIMIT $2",
        )
        .bind(status)
        .bind(limit)
        .fetch_all(&state.pool)
        .await?
    } else {
        sqlx::query_as::<_, WebhookDeliveryRow>(
            "SELECT id, webhook_id, url, event_kind, attempts, max_attempts, status, last_error,
                    next_retry_at, created_at
             FROM webhook_deliveries ORDER BY created_at DESC LIMIT $1",
        )
        .bind(limit)
        .fetch_all(&state.pool)
        .await?
    };
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct PurgeWebhookDeliveriesBody {
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub url_contains: Option<String>,
}

pub async fn purge_webhook_deliveries(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
    Json(body): Json<PurgeWebhookDeliveriesBody>,
) -> Result<Json<serde_json::Value>, ApiError> {
    require_admin(&actor)?;
    let status = body.status.as_deref();
    let url_pat = body
        .url_contains
        .as_deref()
        .map(|s| format!("%{s}%"));
    let deleted = if let (Some(st), Some(url)) = (status, url_pat.as_deref()) {
        sqlx::query("DELETE FROM webhook_deliveries WHERE status = $1 AND url LIKE $2")
            .bind(st)
            .bind(url)
            .execute(&state.pool)
            .await?
            .rows_affected()
    } else if let Some(st) = status {
        sqlx::query("DELETE FROM webhook_deliveries WHERE status = $1")
            .bind(st)
            .execute(&state.pool)
            .await?
            .rows_affected()
    } else if let Some(url) = url_pat.as_deref() {
        sqlx::query("DELETE FROM webhook_deliveries WHERE url LIKE $1")
            .bind(url)
            .execute(&state.pool)
            .await?
            .rows_affected()
    } else {
        return Err(ApiError::bad_request(
            "provide status and/or url_contains to purge deliveries",
        ));
    };
    Ok(Json(serde_json::json!({ "deleted": deleted })))
}

pub async fn retry_webhook_delivery(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<WebhookDeliveryRow>, ApiError> {
    require_admin(&actor)?;
    sqlx::query(
        "UPDATE webhook_deliveries SET status = 'pending', attempts = 0, last_error = '',
         next_retry_at = NOW() WHERE id = $1",
    )
    .bind(id)
    .execute(&state.pool)
    .await?;
    let row = sqlx::query_as::<_, WebhookDeliveryRow>(
        "SELECT id, webhook_id, url, event_kind, attempts, max_attempts, status, last_error,
                next_retry_at, created_at FROM webhook_deliveries WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await?;
    Ok(Json(row))
}
