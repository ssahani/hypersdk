// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::extract::State;
use axum::Json;
use serde::Serialize;

use crate::api::topology::{build_topology, TopologyGraph};
use crate::api::ApiError;
use crate::engine::packetwolf_bridge;
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct NetworkCanvasResponse {
    pub topology: TopologyGraph,
    pub flows: serde_json::Value,
    pub flow_stats: serde_json::Value,
    pub anomalies: serde_json::Value,
    pub packetwolf: packetwolf_bridge::PacketwolfStatus,
}

pub async fn network_canvas(
    State(state): State<AppState>,
) -> Result<Json<NetworkCanvasResponse>, ApiError> {
    let topology = build_topology(&state.pool, None).await?;
    let flows = packetwolf_bridge::fetch_fleet_flows(&state.config, 40).await;
    let flow_stats = packetwolf_bridge::fetch_fleet_flow_stats(&state.config).await;
    let anomalies = packetwolf_bridge::fetch_anomalies(&state.config).await;
    let packetwolf = packetwolf_bridge::status(&state.config);
    Ok(Json(NetworkCanvasResponse {
        topology,
        flows,
        flow_stats,
        anomalies,
        packetwolf,
    }))
}
