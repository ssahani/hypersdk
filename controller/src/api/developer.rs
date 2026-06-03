// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::extract::{Path, State};
use axum::Json;
use uuid::Uuid;

use crate::api::ApiError;
use crate::engine::developer;
use crate::state::AppState;

pub async fn overview() -> Json<developer::DeveloperOverview> {
    Json(developer::overview())
}

pub async fn terraform_schema() -> Json<Vec<developer::TerraformResourceSchema>> {
    Json(developer::terraform_schemas())
}

pub async fn export_vm_iac(
    State(state): State<AppState>,
    Path(vm_id): Path<Uuid>,
) -> Result<Json<developer::VmExportBundle>, ApiError> {
    let row: (String, Option<Uuid>) =
        sqlx::query_as("SELECT name, host_id FROM vms WHERE id = $1")
            .bind(vm_id)
            .fetch_one(&state.pool)
            .await?;
    let host_id = row
        .1
        .ok_or_else(|| ApiError::bad_request("VM has no host"))?;
    let (_, agent_addr) = crate::engine::host_os::resolve_agent_addr(&state.pool, &state.config, host_id)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))?;
    let bundle = developer::export_vm_bundle(&state.pool, &agent_addr, vm_id)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok(Json(bundle))
}
