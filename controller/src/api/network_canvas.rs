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
    pub network_pulse: serde_json::Value,
}

pub async fn network_canvas(
    State(state): State<AppState>,
) -> Result<Json<NetworkCanvasResponse>, ApiError> {
    let topology = build_topology(&state.pool, None).await?;
    let (pw_cfg, discovery) = packetwolf_bridge::resolved_config(&state.config).await;

    let (flows, flow_stats, anomalies, network_pulse) = tokio::join!(
        packetwolf_bridge::fetch_fleet_flows(&pw_cfg, 40),
        packetwolf_bridge::fetch_fleet_flow_stats(&pw_cfg),
        packetwolf_bridge::fetch_anomalies(&pw_cfg),
        packetwolf_bridge::fetch_network_pulse_bundle(&pw_cfg),
    );

    let packetwolf = packetwolf_bridge::status_with_discovery(&pw_cfg, discovery.as_ref());

    Ok(Json(NetworkCanvasResponse {
        topology,
        flows,
        flow_stats,
        anomalies,
        packetwolf,
        network_pulse,
    }))
}
