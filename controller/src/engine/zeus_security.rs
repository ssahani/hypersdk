// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Zeus Security Fabric — fleet risk aggregation and PacketWolf orchestration.

use serde::Serialize;
use sqlx::PgPool;

use crate::config::ControllerConfig;
use crate::engine::ai::security_graph;
use crate::engine::packetwolf_bridge;
use crate::engine::zeus_firewall;

#[derive(Debug, Serialize)]
pub struct ZeusSecurityStatus {
    pub packetwolf: packetwolf_bridge::PacketwolfStatus,
    pub zeus_firewall: serde_json::Value,
    pub fabric_reachable: bool,
}

pub async fn status(cfg: &ControllerConfig) -> ZeusSecurityStatus {
    let pw = packetwolf_bridge::status(cfg);
    ZeusSecurityStatus {
        fabric_reachable: pw.reachable,
        packetwolf: pw,
        zeus_firewall: zeus_firewall::zeus_firewall_status().await,
    }
}

#[derive(Debug, Serialize)]
pub struct FleetThreatSummary {
    pub fleet_threat_score: f32,
    pub firewall_targets: usize,
    pub critical_events: Vec<serde_json::Value>,
    pub packetwolf: serde_json::Value,
    pub security_graph_summary: String,
}

pub async fn fleet_threat(pool: &PgPool, cfg: &ControllerConfig) -> anyhow::Result<FleetThreatSummary> {
    let pw = packetwolf_bridge::fleet_threat_summary(cfg).await;
    let overview = zeus_firewall::overview(pool, cfg).await?;
    let graph = security_graph::build_graph(pool).await?;

    let fleet_score = pw
        .get("fleet_threat_score")
        .and_then(|v| v.as_f64())
        .unwrap_or(75.0) as f32;

    let critical = pw
        .get("critical_events")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    Ok(FleetThreatSummary {
        fleet_threat_score: fleet_score,
        firewall_targets: overview.targets.len(),
        critical_events: critical,
        packetwolf: pw,
        security_graph_summary: format!(
            "{} nodes · {} edges in infrastructure security graph",
            graph.nodes.len(),
            graph.edges.len()
        ),
    })
}

pub async fn host_summary(cfg: &ControllerConfig, host_id: &str) -> serde_json::Value {
    packetwolf_bridge::host_fabric(cfg, host_id, "summary", "").await
}

pub async fn host_resource(
    cfg: &ControllerConfig,
    host_id: &str,
    resource: &str,
    hours: u32,
) -> serde_json::Value {
    let q = if hours > 0 {
        format!("?hours={hours}&limit=100")
    } else {
        String::new()
    };
    packetwolf_bridge::host_fabric(cfg, host_id, resource, &q).await
}
