// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::extract::State;
use axum::Json;
use serde::Deserialize;

use crate::api::ApiError;
use crate::engine::baremetal;
use crate::state::AppState;

pub async fn list_servers(
    State(state): State<AppState>,
) -> Result<Json<Vec<baremetal::BaremetalServer>>, ApiError> {
    baremetal::list_servers(&state.pool)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

pub async fn register_server(
    State(state): State<AppState>,
    Json(body): Json<baremetal::RegisterBaremetalBody>,
) -> Result<Json<baremetal::BaremetalServer>, ApiError> {
    if body.hostname.trim().is_empty() {
        return Err(ApiError::bad_request("hostname required"));
    }
    baremetal::register(&state.pool, &body)
        .await
        .map_err(|e| ApiError::bad_request(e.to_string()))
        .map(Json)
}

#[derive(Debug, Deserialize)]
pub struct CapacityPlanBody {
    pub query: String,
}

pub async fn capacity_plan(
    Json(body): Json<CapacityPlanBody>,
) -> Result<Json<baremetal::BaremetalCapacityPlan>, ApiError> {
    Ok(Json(baremetal::plan_capacity(&body.query)))
}
