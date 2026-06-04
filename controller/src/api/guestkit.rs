// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;
use uuid::Uuid;

use crate::api::ApiError;
use crate::engine::guestkit_bridge;
use crate::state::AppState;

pub async fn guestkit_status(State(state): State<AppState>) -> Json<guestkit_bridge::GuestkitStatus> {
    Json(guestkit_bridge::status(&state.config))
}

#[derive(Debug, Deserialize)]
pub struct GuestkitDiskBody {
    pub image_path: String,
    #[serde(default = "default_kvm_target")]
    pub target: String,
    #[serde(default)]
    pub explain: bool,
}

fn default_kvm_target() -> String {
    "kvm".into()
}

pub async fn guestkit_doctor(
    State(state): State<AppState>,
    Json(body): Json<GuestkitDiskBody>,
) -> Result<Json<guestkit_bridge::GuestkitDoctorReport>, ApiError> {
    guestkit_bridge::doctor_disk(&state.config, &body.image_path, &body.target, body.explain)
        .await
        .map_err(|e| ApiError::bad_request(e.to_string()))
        .map(Json)
}

pub async fn guestkit_migrate_plan(
    State(state): State<AppState>,
    Json(body): Json<GuestkitDiskBody>,
) -> Result<Json<guestkit_bridge::GuestkitMigratePlanReport>, ApiError> {
    guestkit_bridge::migrate_plan_disk(&state.config, &body.image_path, &body.target)
        .await
        .map_err(|e| ApiError::bad_request(e.to_string()))
        .map(Json)
}

#[derive(Debug, Deserialize)]
pub struct GuestkitVmDoctorQuery {
    #[serde(default = "default_kvm_target")]
    pub target: String,
    #[serde(default)]
    pub explain: bool,
}

pub async fn guestkit_vm_doctor(
    State(state): State<AppState>,
    Path(vm_id): Path<Uuid>,
    Query(q): Query<GuestkitVmDoctorQuery>,
) -> Result<Json<guestkit_bridge::GuestkitDoctorReport>, ApiError> {
    guestkit_bridge::doctor_vm(
        &state.config,
        &state.pool,
        &state.config.disk_image_dir,
        vm_id,
        &q.target,
        q.explain,
    )
    .await
    .map_err(|e| ApiError::bad_request(e.to_string()))
    .map(Json)
}

pub async fn guestkit_vm_migrate_plan(
    State(state): State<AppState>,
    Path(vm_id): Path<Uuid>,
    Query(q): Query<GuestkitVmDoctorQuery>,
) -> Result<Json<guestkit_bridge::GuestkitMigratePlanReport>, ApiError> {
    guestkit_bridge::migrate_plan_vm(
        &state.config,
        &state.pool,
        &state.config.disk_image_dir,
        vm_id,
        &q.target,
    )
    .await
    .map_err(|e| ApiError::bad_request(e.to_string()))
    .map(Json)
}

#[derive(Debug, Deserialize)]
pub struct GuestkitJobBody {
    pub image_path: String,
    #[serde(default = "default_job_name")]
    pub name: String,
}

fn default_job_name() -> String {
    "machina-inspect".into()
}

pub async fn guestkit_submit_job(
    State(state): State<AppState>,
    Json(body): Json<GuestkitJobBody>,
) -> Result<Json<guestkit_bridge::GuestkitJobSubmitResult>, ApiError> {
    guestkit_bridge::submit_inspect_job(&state.config, &body.image_path, &body.name)
        .await
        .map_err(|e| ApiError::bad_request(e.to_string()))
        .map(Json)
}

pub async fn guestkit_job_status(
    State(state): State<AppState>,
    Path(job_id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    guestkit_bridge::get_worker_job_status(&state.config, &job_id)
        .await
        .map_err(|e| ApiError::bad_request(e.to_string()))
        .map(Json)
}
