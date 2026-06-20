// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::extract::{Query, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api::ApiError;
use crate::state::AppState;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AuditRow {
    pub id: Uuid,
    pub actor: String,
    pub action: String,
    pub resource_type: Option<String>,
    pub resource_id: Option<Uuid>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct AuditQuery {
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub actor: Option<String>,
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    100
}

pub async fn list_audit_logs(
    State(state): State<AppState>,
    Query(q): Query<AuditQuery>,
) -> Result<Json<Vec<AuditRow>>, ApiError> {
    let limit = q.limit.clamp(1, 500);
    let rows = match (&q.action, &q.actor) {
        (Some(action), Some(actor)) if !action.is_empty() && !actor.is_empty() => {
            sqlx::query_as::<_, AuditRow>(
                "SELECT id, actor, action, resource_type, resource_id, created_at
                 FROM audit_logs WHERE action LIKE ? AND actor LIKE ? ORDER BY created_at DESC LIMIT ?",
            )
            .bind(format!("%{action}%"))
            .bind(format!("%{actor}%"))
            .bind(limit)
            .fetch_all(&state.pool)
            .await?
        }
        (Some(action), _) if !action.is_empty() => {
            sqlx::query_as::<_, AuditRow>(
                "SELECT id, actor, action, resource_type, resource_id, created_at
                 FROM audit_logs WHERE action LIKE ? ORDER BY created_at DESC LIMIT ?",
            )
            .bind(format!("%{action}%"))
            .bind(limit)
            .fetch_all(&state.pool)
            .await?
        }
        (_, Some(actor)) if !actor.is_empty() => {
            sqlx::query_as::<_, AuditRow>(
                "SELECT id, actor, action, resource_type, resource_id, created_at
                 FROM audit_logs WHERE actor LIKE ? ORDER BY created_at DESC LIMIT ?",
            )
            .bind(format!("%{actor}%"))
            .bind(limit)
            .fetch_all(&state.pool)
            .await?
        }
        _ => {
            sqlx::query_as::<_, AuditRow>(
                "SELECT id, actor, action, resource_type, resource_id, created_at
                 FROM audit_logs ORDER BY created_at DESC LIMIT ?",
            )
            .bind(limit)
            .fetch_all(&state.pool)
            .await?
        }
    };
    Ok(Json(rows))
}
