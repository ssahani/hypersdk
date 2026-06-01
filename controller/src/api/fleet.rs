// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::extract::State;
use axum::Json;

use crate::api::ApiError;
use crate::engine::fleet_desktop;
use crate::engine::fleet_linux;
use crate::engine::fleet_activity;
use crate::engine::fleet_backups;
use crate::engine::fleet_finder;
use crate::engine::fleet_network;
use crate::engine::fleet_storage;
use crate::engine::fleet_console;
use crate::engine::fleet_updates;
use crate::engine::fleet_keychain;
use crate::engine::fleet_users;
use crate::engine::fleet_shortcuts;
use crate::engine::fleet_spaces;
use crate::engine::fleet_general;
use crate::engine::fleet_mission;
use crate::engine::fleet_maintenance_mission;
use crate::engine::fleet_dna;
use crate::engine::fleet_gpu;
use crate::state::AppState;

pub async fn desktop_overview(
    State(state): State<AppState>,
) -> Result<Json<fleet_desktop::FleetDesktopOverview>, ApiError> {
    fleet_desktop::overview(&state.pool, &state.config)
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

pub async fn linux_health(
    State(state): State<AppState>,
) -> Result<Json<fleet_linux::FleetLinuxHealthOverview>, ApiError> {
    fleet_linux::overview(&state.pool, &state.config)
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

pub async fn activity_overview(
    State(state): State<AppState>,
) -> Result<Json<fleet_activity::FleetActivityOverview>, ApiError> {
    fleet_activity::overview(&state.pool, &state.config)
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

pub async fn backup_overview(
    State(state): State<AppState>,
) -> Result<Json<fleet_backups::FleetBackupOverview>, ApiError> {
    fleet_backups::overview(&state.pool)
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

pub async fn finder_overview(
    State(state): State<AppState>,
) -> Result<Json<fleet_finder::FleetFinderOverview>, ApiError> {
    fleet_finder::overview(&state.pool)
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

pub async fn network_overview(
    State(state): State<AppState>,
) -> Result<Json<fleet_network::FleetNetworkOverview>, ApiError> {
    fleet_network::overview(&state.pool)
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

pub async fn storage_overview(
    State(state): State<AppState>,
) -> Result<Json<fleet_storage::FleetStorageOverview>, ApiError> {
    fleet_storage::overview(&state.pool, &state.config)
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

pub async fn console_overview(
    State(state): State<AppState>,
) -> Result<Json<fleet_console::FleetConsoleOverview>, ApiError> {
    fleet_console::overview(&state.pool)
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

pub async fn updates_overview(
    State(state): State<AppState>,
) -> Result<Json<fleet_updates::FleetUpdatesOverview>, ApiError> {
    fleet_updates::overview(&state.pool, &state.config)
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

pub async fn keychain_overview(
    State(state): State<AppState>,
) -> Result<Json<fleet_keychain::FleetKeychainOverview>, ApiError> {
    fleet_keychain::overview(&state.pool)
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

pub async fn users_overview(
    State(state): State<AppState>,
) -> Result<Json<fleet_users::FleetUsersOverview>, ApiError> {
    fleet_users::overview(&state.pool)
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

pub async fn shortcuts_overview(
    State(state): State<AppState>,
) -> Result<Json<fleet_shortcuts::FleetShortcutsOverview>, ApiError> {
    fleet_shortcuts::overview(&state.pool)
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

pub async fn spaces_overview(
    State(state): State<AppState>,
) -> Result<Json<fleet_spaces::FleetSpacesOverview>, ApiError> {
    fleet_spaces::overview(&state.pool)
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

pub async fn general_overview(
    State(state): State<AppState>,
) -> Result<Json<fleet_general::FleetGeneralOverview>, ApiError> {
    fleet_general::overview(&state.pool)
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

pub async fn mission_overview(
    State(state): State<AppState>,
) -> Result<Json<fleet_mission::FleetMissionOverview>, ApiError> {
    fleet_mission::overview(&state.pool)
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

pub async fn gpu_overview(
    State(state): State<AppState>,
) -> Result<Json<fleet_gpu::FleetGpuOverview>, ApiError> {
    fleet_gpu::overview(&state.pool)
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

pub async fn maintenance_mission_overview(
    State(state): State<AppState>,
) -> Result<Json<fleet_maintenance_mission::FleetMaintenanceMissionOverview>, ApiError> {
    fleet_maintenance_mission::overview(&state.pool, &state.config)
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

pub async fn dna_overview(
    State(state): State<AppState>,
) -> Result<Json<fleet_dna::FleetDnaOverview>, ApiError> {
    fleet_dna::overview(&state.pool, &state.config)
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

#[derive(Debug, serde::Deserialize)]
pub struct FleetDiagnoseBody {
    pub query: String,
}

pub async fn fleet_diagnose(
    State(state): State<AppState>,
    Json(body): Json<FleetDiagnoseBody>,
) -> Result<Json<fleet_linux::FleetDiagnoseReport>, ApiError> {
    fleet_linux::diagnose(&state.pool, &state.config, &body.query)
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}
