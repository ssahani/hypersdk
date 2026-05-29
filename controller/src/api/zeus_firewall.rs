// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::extract::{Path, Query, State};
use axum::Extension;
use axum::Json;
use machina_core::FirewallPlanRequest;
use serde::Deserialize;
use uuid::Uuid;

use crate::api::ApiError;
use crate::auth::AuthUser;
use crate::engine::ai::firewall as ai_firewall;
use crate::engine::packetwolf_bridge;
use crate::engine::zeus_firewall;
use crate::state::AppState;

pub async fn status(State(state): State<AppState>) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "zeus_firewall": zeus_firewall::zeus_firewall_status().await,
        "packetwolf": packetwolf_bridge::status(&state.config),
    }))
}

pub async fn overview(State(state): State<AppState>) -> Result<Json<zeus_firewall::FirewallOverview>, ApiError> {
    zeus_firewall::overview(&state.pool, &state.config)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

pub async fn get_target(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<zeus_firewall::FirewallTargetDetail>, ApiError> {
    zeus_firewall::target_detail(&state.pool, &state.config, &id)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

pub async fn get_ports(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Vec<machina_core::OpenPort>>, ApiError> {
    zeus_firewall::target_ports(&state.pool, &state.config, &id)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

pub async fn get_services(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Vec<machina_core::firewall::types::AllowedService>>, ApiError> {
    zeus_firewall::target_services(&state.pool, &state.config, &id)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

pub async fn get_score(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<machina_core::FirewallScore>, ApiError> {
    zeus_firewall::target_score(&state.pool, &state.config, &id)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

#[derive(Debug, Deserialize)]
pub struct PlanBody {
    pub profile: Option<String>,
    pub preset: Option<String>,
    pub enable: Option<bool>,
    pub stealth_level: Option<String>,
    #[serde(default = "default_true")]
    pub dry_run: bool,
}

fn default_true() -> bool {
    true
}

pub async fn plan_target(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<PlanBody>,
) -> Result<Json<machina_core::FirewallPlanResult>, ApiError> {
    let stealth = body.stealth_level.as_deref().map(machina_core::firewall::apply::stealth_level_from_str);
    let req = FirewallPlanRequest {
        profile: body.profile,
        enable: body.enable,
        stealth_level: stealth,
        preset: body.preset,
        dry_run: body.dry_run,
    };
    zeus_firewall::plan_target(&state.pool, &state.config, &id, req)
        .await
        .map_err(|e| ApiError::bad_request(e.to_string()))
        .map(Json)
}

pub async fn apply_target(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<PlanBody>,
) -> Result<Json<machina_core::FirewallPlanResult>, ApiError> {
    let stealth = body.stealth_level.as_deref().map(machina_core::firewall::apply::stealth_level_from_str);
    let req = FirewallPlanRequest {
        profile: body.profile,
        enable: body.enable,
        stealth_level: stealth,
        preset: body.preset,
        dry_run: false,
    };
    zeus_firewall::apply_target(&state.pool, &state.config, &id, req, &actor.username)
        .await
        .map_err(|e| ApiError::bad_request(e.to_string()))
        .map(Json)
}

pub async fn list_profiles(
    State(state): State<AppState>,
) -> Result<Json<Vec<zeus_firewall::profiles::ProfileListItem>>, ApiError> {
    zeus_firewall::profiles::list_profiles(&state.pool)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

pub async fn create_temporary_rule(
    State(state): State<AppState>,
    Json(body): Json<zeus_firewall::temporary::TemporaryRuleRequest>,
) -> Result<Json<zeus_firewall::temporary::TemporaryRule>, ApiError> {
    zeus_firewall::temporary::create_temporary_rule(&state.pool, body)
        .await
        .map_err(|e| ApiError::bad_request(e.to_string()))
        .map(Json)
}

pub async fn get_timeline(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Vec<serde_json::Value>>, ApiError> {
    let host_id = Uuid::parse_str(&id).map_err(|e| ApiError::bad_request(e.to_string()))?;
    zeus_firewall::temporary::timeline(&state.pool, "host", host_id)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

#[derive(Debug, Deserialize)]
pub struct LockdownBody {
    #[serde(default)]
    pub capture: bool,
}

pub async fn lockdown(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<LockdownBody>,
) -> Result<Json<serde_json::Value>, ApiError> {
    zeus_firewall::lockdown_target(&state.pool, &state.config, &id, body.capture, &actor.username)
        .await
        .map_err(|e| ApiError::bad_request(e.to_string()))
        .map(Json)
}

#[derive(Debug, Deserialize)]
pub struct ProfileBody {
    pub profile: String,
    #[serde(default = "default_true")]
    pub dry_run: bool,
}

pub async fn apply_profile(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<ProfileBody>,
) -> Result<Json<machina_core::FirewallPlanResult>, ApiError> {
    zeus_firewall::apply_profile(
        &state.pool,
        &state.config,
        &id,
        &body.profile,
        &actor.username,
        body.dry_run,
    )
    .await
    .map_err(|e| ApiError::bad_request(e.to_string()))
    .map(Json)
}

pub async fn list_checkpoints(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Vec<zeus_firewall::checkpoint::CheckpointSummary>>, ApiError> {
    let host_id = Uuid::parse_str(&id).map_err(|e| ApiError::bad_request(e.to_string()))?;
    zeus_firewall::checkpoint::list_checkpoints(&state.pool, "host", host_id)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

#[derive(Debug, Deserialize)]
pub struct RollbackBody {
    pub checkpoint_id: Uuid,
}

pub async fn rollback(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<RollbackBody>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let host_id = Uuid::parse_str(&id).map_err(|e| ApiError::bad_request(e.to_string()))?;
    zeus_firewall::checkpoint::rollback_checkpoint(
        &state.pool,
        "host",
        host_id,
        body.checkpoint_id,
        &actor.username,
    )
    .await
    .map_err(|e| ApiError::bad_request(e.to_string()))
    .map(Json)
}

#[derive(Debug, Deserialize)]
pub struct SimulateBody {
    pub target_id: String,
    #[serde(default = "default_profile")]
    pub profile: String,
}

fn default_profile() -> String {
    "ProductionServer".into()
}

pub async fn simulate(
    State(state): State<AppState>,
    Json(body): Json<SimulateBody>,
) -> Result<Json<serde_json::Value>, ApiError> {
    ai_firewall::simulate_plan(&state.pool, &state.config, &body.target_id, &body.profile)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

#[derive(Debug, Deserialize)]
pub struct ExplainBody {
    pub target_id: String,
    pub question: Option<String>,
}

pub async fn ai_explain(
    State(state): State<AppState>,
    Json(body): Json<ExplainBody>,
) -> Result<Json<ai_firewall::FirewallExplainReport>, ApiError> {
    ai_firewall::explain_exposure(
        &state.pool,
        &state.config,
        &body.target_id,
        body.question.as_deref(),
    )
    .await
    .map_err(|e| ApiError::internal(e.to_string()))
    .map(Json)
}

pub async fn ai_secure_plan(
    State(state): State<AppState>,
    Json(body): Json<ExplainBody>,
) -> Result<Json<ai_firewall::SecurePlanReport>, ApiError> {
    ai_firewall::secure_machine_plan(&state.pool, &state.config, &body.target_id)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

pub async fn compliance_report(
    State(state): State<AppState>,
    Path(kind): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    ai_firewall::compliance_report(&state.pool, &state.config, &kind)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

#[derive(Debug, Deserialize)]
pub struct SiemExportQuery {
    #[serde(default = "default_siem_hours")]
    pub hours: i32,
}

fn default_siem_hours() -> i32 {
    168
}

pub async fn siem_export(
    State(state): State<AppState>,
    Query(q): Query<SiemExportQuery>,
) -> Result<Json<zeus_firewall::siem::SiemFirewallExport>, ApiError> {
    zeus_firewall::siem::export_timeline(&state.pool, q.hours)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

#[derive(Debug, Deserialize)]
pub struct DriftQuery {
    pub target_kind: Option<String>,
}

pub async fn detect_drift(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<zeus_firewall::drift::DriftReport>, ApiError> {
    let host_id = Uuid::parse_str(&id).map_err(|e| ApiError::bad_request(e.to_string()))?;
    let detail = zeus_firewall::target_detail(&state.pool, &state.config, &id)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))?;
    zeus_firewall::drift::detect_drift(&state.pool, "host", host_id, &detail.inventory)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

pub async fn get_activity(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(q): Query<ActivityQuery>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let hours = q.hours.unwrap_or(24);
    if state.config.packetwolf_enabled {
        Ok(Json(
            packetwolf_bridge::fetch_activity(&id, hours).await,
        ))
    } else if let Ok(addr) = resolve_agent(&state, &id).await {
        if let Ok(act) = crate::agent_client::get_firewall_activity(&addr, hours).await {
            return Ok(Json(act));
        }
        Ok(Json(serde_json::json!({ "events": [], "note": "activity unavailable" })))
    } else {
        Ok(Json(serde_json::json!({ "events": [], "note": "no agent" })))
    }
}

#[derive(Debug, Deserialize)]
pub struct ActivityQuery {
    pub hours: Option<u32>,
}

async fn resolve_agent(state: &AppState, target_id: &str) -> anyhow::Result<String> {
    if target_id == "local" {
        return Ok(state.config.default_agent_addr.clone());
    }
    let host_id = Uuid::parse_str(target_id)?;
    let addr: String = sqlx::query_scalar("SELECT COALESCE(agent_grpc_addr, '') FROM hosts WHERE id = $1")
        .bind(host_id)
        .fetch_one(&state.pool)
        .await?;
    if addr.is_empty() {
        anyhow::bail!("no agent");
    }
    Ok(addr)
}

#[derive(Debug, Deserialize)]
pub struct PolicyBody {
    pub name: String,
    pub spec_yaml: String,
}

pub async fn list_policies(State(state): State<AppState>) -> Result<Json<Vec<serde_json::Value>>, ApiError> {
    let rows: Vec<(Uuid, String, String)> =
        sqlx::query_as("SELECT id, name, spec_yaml FROM firewall_policies ORDER BY name")
            .fetch_all(&state.pool)
            .await
            .unwrap_or_default();
    Ok(Json(
        rows.into_iter()
            .map(|(id, name, spec_yaml)| serde_json::json!({ "id": id, "name": name, "spec_yaml": spec_yaml }))
            .collect(),
    ))
}

pub async fn create_policy(
    State(state): State<AppState>,
    Json(body): Json<PolicyBody>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let id = Uuid::new_v4();
    sqlx::query("INSERT INTO firewall_policies (id, name, spec_yaml) VALUES ($1, $2, $3)")
        .bind(id)
        .bind(&body.name)
        .bind(&body.spec_yaml)
        .execute(&state.pool)
        .await
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    Ok(Json(serde_json::json!({ "id": id, "name": body.name })))
}

pub async fn request_risky_change(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
    Json(body): Json<PlanBody>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO events (kind, severity, message, resource_type)
         VALUES ('approval', 'warning', $1, 'zeus_firewall')",
    )
    .bind(format!(
        "Firewall change approval requested by {} for profile {:?}",
        actor.username, body.profile
    ))
    .execute(&state.pool)
    .await
    .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok(Json(serde_json::json!({
        "approval_id": id,
        "status": "pending",
        "required_roles": ["Security Admin", "Workspace Owner", "Production Owner"]
    })))
}
