// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::extract::{Path, Query, State};
use axum::Json;
use uuid::Uuid;

use crate::api::ApiError;
use crate::engine::host_os;
use crate::state::AppState;

pub async fn host_linux_observability(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    host_os::linux_observability(&state.pool, &state.config, id)
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

pub async fn host_network_diagnostics(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    host_os::network_diagnostics(&state.pool, &state.config, id)
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

pub async fn host_linux_audit(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    host_os::linux_audit(&state.pool, &state.config, id)
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

pub async fn host_linux_package_updates(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    host_os::linux_package_updates(&state.pool, &state.config, id)
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

pub async fn vm_guest_health(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<host_os::VmGuestHealthReport>, ApiError> {
    host_os::vm_guest_health(&state.pool, &state.config, id)
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

pub async fn vm_guest_observability(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    host_os::vm_guest_observability(&state.pool, &state.config, id)
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

pub async fn vm_guest_services(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<host_os::VmGuestServicesReport>, ApiError> {
    host_os::vm_guest_services(&state.pool, &state.config, id)
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

pub async fn vm_guest_sync_time(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    host_os::vm_guest_agent_action(&state.pool, &state.config, id, "sync_time")
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

pub async fn vm_guest_fstrim(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    host_os::vm_guest_agent_action(&state.pool, &state.config, id, "fstrim")
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

pub async fn vm_guest_fs_freeze_status(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    host_os::vm_guest_agent_action(&state.pool, &state.config, id, "fs_freeze_status")
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

#[derive(Debug, serde::Deserialize)]
pub struct GuestAiInsightsQuery {
    #[serde(default)]
    pub refresh: bool,
    pub focus: Option<String>,
}

pub async fn vm_guest_ai_insights(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(q): Query<GuestAiInsightsQuery>,
) -> Result<Json<crate::engine::ai::guest_insights::GuestAiInsightsReport>, ApiError> {
    crate::engine::ai::guest_insights::generate_insights(
        &state.pool,
        &state.config,
        id,
        q.refresh,
        q.focus.as_deref(),
    )
    .await
    .map(Json)
    .map_err(|e| ApiError::internal(e.to_string()))
}

#[derive(Debug, serde::Deserialize)]
pub struct OsDiagnoseBody {
    pub query: Option<String>,
}

pub async fn diagnose_host(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<OsDiagnoseBody>,
) -> Result<Json<host_os::HostOsDiagnoseReport>, ApiError> {
    host_os::diagnose_host(&state.pool, &state.config, id, body.query.as_deref())
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

pub async fn diagnose_vm(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<OsDiagnoseBody>,
) -> Result<Json<host_os::VmOsDiagnoseReport>, ApiError> {
    host_os::diagnose_vm(&state.pool, &state.config, id, body.query.as_deref())
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}
