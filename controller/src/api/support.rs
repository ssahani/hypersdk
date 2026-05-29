// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::extract::State;
use axum::response::IntoResponse;
use axum::Json;
use serde::Serialize;

use crate::api::ApiError;
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct SupportBundleMeta {
    pub controller_id: String,
    pub generated_at: String,
    pub task_count: i64,
    pub host_count: i64,
    pub vm_count: i64,
    pub recent_failures: serde_json::Value,
    pub audit_tail: serde_json::Value,
    pub version_matrix: serde_json::Value,
}

pub async fn support_bundle(
    State(state): State<AppState>,
) -> Result<impl IntoResponse, ApiError> {
    let task_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM tasks")
        .fetch_one(&state.pool)
        .await?;
    let host_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM hosts")
        .fetch_one(&state.pool)
        .await?;
    let vm_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM vms")
        .fetch_one(&state.pool)
        .await?;

    let recent_failures: serde_json::Value = sqlx::query_scalar(
        "SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
            SELECT id, operation, status, message, created_at FROM tasks
            WHERE status = 'failed' ORDER BY created_at DESC LIMIT 20
         ) t",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(serde_json::json!([]));

    let audit_tail: serde_json::Value = sqlx::query_scalar(
        "SELECT COALESCE(json_agg(row_to_json(a)), '[]'::json) FROM (
            SELECT actor, action, resource_type, resource_id, created_at FROM audit_logs
            ORDER BY created_at DESC LIMIT 50
         ) a",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(serde_json::json!([]));

    let version_matrix: serde_json::Value = sqlx::query_scalar(
        "SELECT COALESCE(json_agg(row_to_json(h)), '[]'::json) FROM (
            SELECT hostname, agent_version, libvirt_version, qemu_version, cpu_model, state
            FROM hosts ORDER BY hostname
         ) h",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(serde_json::json!([]));

    let bundle = SupportBundleMeta {
        controller_id: state.config.controller_id.clone(),
        generated_at: chrono::Utc::now().to_rfc3339(),
        task_count,
        host_count,
        vm_count,
        recent_failures,
        audit_tail,
        version_matrix,
    };

    Ok(Json(bundle))
}
