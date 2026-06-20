// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::extract::{Path, State};
use axum::Json;
use uuid::Uuid;

use crate::api::ApiError;
use crate::engine::host_validate;
use crate::engine::vm_health;
use crate::state::AppState;

pub async fn vm_health_check(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<vm_health::VmHealthReport>, ApiError> {
    let report = vm_health::run_vm_health_check(&state.pool, id)
        .await
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    Ok(Json(report))
}

pub async fn host_health_check(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<host_validate::HostValidationReport>, ApiError> {
    let report = host_validate::validate_host(&state.pool, id)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok(Json(report))
}
