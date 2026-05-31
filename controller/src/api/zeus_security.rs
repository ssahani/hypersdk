// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;

use crate::api::ApiError;
use crate::engine::ai::security as ai_security;
use crate::engine::ai::security_graph;
use crate::engine::packetwolf_bridge;
use crate::engine::zeus_security;
use crate::state::AppState;

pub async fn status(State(state): State<AppState>) -> Json<zeus_security::ZeusSecurityStatus> {
    Json(zeus_security::status(&state.config).await)
}

pub async fn fleet_threat(State(state): State<AppState>) -> Result<Json<zeus_security::FleetThreatSummary>, ApiError> {
    zeus_security::fleet_threat(&state.pool, &state.config)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

pub async fn sensors(State(state): State<AppState>) -> Json<serde_json::Value> {
    Json(packetwolf_bridge::sensors(&state.config).await)
}

pub async fn asset_inventory(State(state): State<AppState>) -> Json<serde_json::Value> {
    Json(packetwolf_bridge::asset_inventory(&state.config).await)
}

pub async fn fleet_timeline(
    State(state): State<AppState>,
    Query(q): Query<HostQuery>,
) -> Json<serde_json::Value> {
    Json(zeus_security::fleet_timeline(&state.config, q.hours.unwrap_or(24)).await)
}

pub async fn sync_alerts(State(state): State<AppState>) -> Result<Json<serde_json::Value>, ApiError> {
    let n = zeus_security::sync_security_alerts(&state.pool, &state.config)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok(Json(serde_json::json!({ "inserted": n, "summary": format!("Synced {n} security alert(s) to notification outbox") })))
}

pub async fn correlations(State(state): State<AppState>) -> Json<serde_json::Value> {
    Json(packetwolf_bridge::correlations(&state.config).await)
}

pub async fn security_graph(State(state): State<AppState>) -> Result<Json<security_graph::SecurityGraph>, ApiError> {
    security_graph::build_graph(&state.pool)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

#[derive(Debug, Deserialize)]
pub struct HostQuery {
    pub hours: Option<u32>,
}

pub async fn host_summary(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Json<serde_json::Value> {
    Json(zeus_security::host_summary(&state.config, &id).await)
}

pub async fn host_processes(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(q): Query<HostQuery>,
) -> Json<serde_json::Value> {
    Json(zeus_security::host_resource(&state.config, &id, "processes", q.hours.unwrap_or(24)).await)
}

pub async fn host_connections(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(q): Query<HostQuery>,
) -> Json<serde_json::Value> {
    Json(zeus_security::host_resource(&state.config, &id, "connections", q.hours.unwrap_or(24)).await)
}

pub async fn host_dns(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(q): Query<HostQuery>,
) -> Json<serde_json::Value> {
    Json(zeus_security::host_resource(&state.config, &id, "dns", q.hours.unwrap_or(24)).await)
}

pub async fn host_files(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(q): Query<HostQuery>,
) -> Json<serde_json::Value> {
    Json(zeus_security::host_resource(&state.config, &id, "files", q.hours.unwrap_or(168)).await)
}

pub async fn host_ports(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Json<serde_json::Value> {
    Json(zeus_security::host_resource(&state.config, &id, "ports", 0).await)
}

pub async fn host_containers(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Json<serde_json::Value> {
    Json(zeus_security::host_resource(&state.config, &id, "containers", 0).await)
}

pub async fn host_timeline(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(q): Query<HostQuery>,
) -> Json<serde_json::Value> {
    Json(zeus_security::host_resource(&state.config, &id, "timeline", q.hours.unwrap_or(24)).await)
}

#[derive(Debug, Deserialize)]
pub struct ProcessGraphQuery {
    pub pid: Option<i64>,
}

pub async fn host_process_graph(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(q): Query<ProcessGraphQuery>,
) -> Json<serde_json::Value> {
    let pid_q = q.pid.map(|p| format!("?pid={p}")).unwrap_or_default();
    Json(
        packetwolf_bridge::host_fabric(&state.config, &id, "process-graph", &pid_q).await,
    )
}

#[derive(Debug, Deserialize)]
pub struct SearchBody {
    pub query: String,
    pub host_id: Option<String>,
}

pub async fn search(
    State(state): State<AppState>,
    Json(body): Json<SearchBody>,
) -> Json<serde_json::Value> {
    Json(
        packetwolf_bridge::search(&state.config, &body.query, body.host_id.as_deref()).await,
    )
}

pub async fn install_tetragon(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    use crate::tasks::enqueue::enqueue_task;
    use uuid::Uuid;

    let pw = packetwolf_bridge::register_sensor(&state.config, &id).await;
    let host_uuid = Uuid::parse_str(&id).ok();
    let task_id = enqueue_task(
        &state,
        "host.tetragon.install",
        serde_json::json!({ "host_id": id, "packetwolf_base_url": state.config.packetwolf_base_url }),
        Some("host"),
        host_uuid,
        host_uuid,
    )
    .await?;
    Ok(Json(serde_json::json!({
        "task_id": task_id.to_string(),
        "packetwolf": pw,
        "summary": "Tetragon sensor enrollment queued"
    })))
}

#[derive(Debug, Deserialize)]
pub struct K8sTetragonBody {
    pub cluster_name: Option<String>,
}

pub async fn install_k8s_tetragon(
    State(state): State<AppState>,
    Path(cluster_id): Path<String>,
    Json(body): Json<K8sTetragonBody>,
) -> Result<Json<serde_json::Value>, ApiError> {
    use crate::tasks::enqueue::enqueue_task;

    let cluster = body.cluster_name.unwrap_or_else(|| cluster_id.clone());
    let task_id = enqueue_task(
        &state,
        "k8s.tetragon.install",
        serde_json::json!({
            "cluster_id": cluster_id,
            "cluster_name": cluster,
            "helm_release": "tetragon",
            "namespace": "kube-system",
        }),
        Some("k8s"),
        None,
        None,
    )
    .await?;
    Ok(Json(serde_json::json!({
        "task_id": task_id.to_string(),
        "cluster_id": cluster_id,
        "summary": format!("Tetragon Helm install queued for cluster {cluster}")
    })))
}

#[derive(Debug, Deserialize)]
pub struct ExplainEventBody {
    pub event: serde_json::Value,
    pub host_id: Option<String>,
}

pub async fn explain_event(
    Json(body): Json<ExplainEventBody>,
) -> Result<Json<serde_json::Value>, ApiError> {
    ai_security::explain_event(&body.event, body.host_id.as_deref())
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

#[derive(Debug, Deserialize)]
pub struct AttackReconstructBody {
    pub host_id: String,
    pub hours: Option<u32>,
}

pub async fn attack_reconstruct(
    State(state): State<AppState>,
    Json(body): Json<AttackReconstructBody>,
) -> Json<serde_json::Value> {
    let timeline = zeus_security::host_resource(
        &state.config,
        &body.host_id,
        "timeline",
        body.hours.unwrap_or(24),
    )
    .await;
    Json(ai_security::attack_reconstruct_sync(&timeline))
}

#[derive(Debug, Deserialize)]
pub struct NlSearchBody {
    pub query: String,
    pub host_id: Option<String>,
}

pub async fn nl_search(
    State(state): State<AppState>,
    Json(body): Json<NlSearchBody>,
) -> Json<serde_json::Value> {
    let translated = ai_security::translate_nl_search(&body.query);
    let results = packetwolf_bridge::search(
        &state.config,
        &translated,
        body.host_id.as_deref(),
    )
    .await;
    Json(serde_json::json!({
        "original_query": body.query,
        "search_query": translated,
        "results": results
    }))
}
