// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::extract::State;
use axum::Json;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api::ApiError;
use crate::engine::policy;
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct PolicyRuleRow {
    pub id: Uuid,
    pub name: String,
    pub enabled: bool,
    pub rule_json: serde_json::Value,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ProjectQuotaRow {
    pub project: String,
    pub max_vms: i32,
    pub max_vcpu: i32,
    pub max_memory_mib: i64,
    pub max_storage_gib: i64,
}

pub async fn list_policy_rules(
    State(state): State<AppState>,
) -> Result<Json<Vec<PolicyRuleRow>>, ApiError> {
    let rows = policy::list_policy_rules(&state.pool).await?;
    Ok(Json(
        rows.into_iter()
            .map(|(id, name, enabled, rule_json)| PolicyRuleRow {
                id,
                name,
                enabled,
                rule_json,
            })
            .collect(),
    ))
}

pub async fn list_project_quotas(
    State(state): State<AppState>,
) -> Result<Json<Vec<ProjectQuotaRow>>, ApiError> {
    let rows = sqlx::query_as::<_, ProjectQuotaRow>(
        "SELECT project, max_vms, max_vcpu, max_memory_mib, max_storage_gib FROM project_quotas ORDER BY project",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct UpsertQuotaBody {
    pub project: String,
    pub max_vms: i32,
    pub max_vcpu: i32,
    pub max_memory_mib: i64,
    pub max_storage_gib: i64,
}

pub async fn upsert_project_quota(
    State(state): State<AppState>,
    Json(body): Json<UpsertQuotaBody>,
) -> Result<Json<ProjectQuotaRow>, ApiError> {
    policy::upsert_project_quota(
        &state.pool,
        &body.project,
        body.max_vms,
        body.max_vcpu,
        body.max_memory_mib,
        body.max_storage_gib,
    )
    .await?;
    Ok(Json(ProjectQuotaRow {
        project: body.project,
        max_vms: body.max_vms,
        max_vcpu: body.max_vcpu,
        max_memory_mib: body.max_memory_mib,
        max_storage_gib: body.max_storage_gib,
    }))
}
