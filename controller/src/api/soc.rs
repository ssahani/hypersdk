// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::extract::{Path, Query, State};
use axum::Extension;
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

use crate::api::ApiError;
use crate::auth::{require_admin, require_operator, AuthUser};
use crate::engine::soc::{asm, detection, run_cycle};
use crate::engine::soc::siem::{elastic_bulk, forward_replay, qradar_rest, sentinel_dcr, splunk_hec};
use crate::state::AppState;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SocEventRow {
    pub id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub source: String,
    pub category: String,
    pub severity: String,
    pub host_id: Option<Uuid>,
    pub vm_id: Option<Uuid>,
    pub actor: Option<String>,
    pub summary: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SocAlertRow {
    pub id: Uuid,
    pub rule_id: Option<Uuid>,
    pub title: String,
    pub severity: String,
    pub status: String,
    pub assigned_to: Option<String>,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
    pub event_count: i32,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SocRuleRow {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub enabled: bool,
    pub severity: String,
    pub query_json: Value,
    pub throttle_minutes: i32,
    pub builtin: bool,
}

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub limit: Option<i64>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PatchAlertBody {
    pub status: Option<String>,
    pub assigned_to: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpsertRuleBody {
    pub name: String,
    pub description: Option<String>,
    pub enabled: Option<bool>,
    pub severity: Option<String>,
    pub query_json: Value,
    pub throttle_minutes: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct PatchRuleBody {
    pub enabled: Option<bool>,
    pub severity: Option<String>,
    pub query_json: Option<Value>,
    pub throttle_minutes: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct SplunkConfigBody {
    pub url: String,
    pub token: String,
    pub index: Option<String>,
    pub sourcetype_events: Option<String>,
    pub sourcetype_alerts: Option<String>,
    pub host: Option<String>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct IntegrationConfigBody {
    pub enabled: Option<bool>,
    pub config_json: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct ReplayQuery {
    pub hours: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct TestRuleQuery {
    pub hours: Option<i32>,
}

pub async fn list_events(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<SocEventRow>>, ApiError> {
    require_operator(&actor)?;
    let limit = q.limit.unwrap_or(100).clamp(1, 500);
    let rows = sqlx::query_as::<_, SocEventRow>(
        "SELECT id, occurred_at, source, category, severity, host_id, vm_id, actor, summary
         FROM soc_events ORDER BY occurred_at DESC LIMIT $1",
    )
    .bind(limit)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

pub async fn list_alerts(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<SocAlertRow>>, ApiError> {
    require_operator(&actor)?;
    let limit = q.limit.unwrap_or(100).clamp(1, 500);
    let rows = if let Some(status) = q.status.filter(|s| !s.is_empty()) {
        sqlx::query_as::<_, SocAlertRow>(
            "SELECT id, rule_id, title, severity, status, assigned_to, first_seen, last_seen, event_count
             FROM soc_alerts WHERE status = $1 ORDER BY last_seen DESC LIMIT $2",
        )
        .bind(status)
        .bind(limit)
        .fetch_all(&state.pool)
        .await?
    } else {
        sqlx::query_as::<_, SocAlertRow>(
            "SELECT id, rule_id, title, severity, status, assigned_to, first_seen, last_seen, event_count
             FROM soc_alerts ORDER BY last_seen DESC LIMIT $1",
        )
        .bind(limit)
        .fetch_all(&state.pool)
        .await?
    };
    Ok(Json(rows))
}

pub async fn patch_alert(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(body): Json<PatchAlertBody>,
) -> Result<Json<SocAlertRow>, ApiError> {
    require_admin(&actor)?;
    if let Some(status) = &body.status {
        sqlx::query("UPDATE soc_alerts SET status = $2, updated_at = NOW() WHERE id = $1")
            .bind(id)
            .bind(status)
            .execute(&state.pool)
            .await?;
    }
    if let Some(assignee) = &body.assigned_to {
        sqlx::query("UPDATE soc_alerts SET assigned_to = $2, updated_at = NOW() WHERE id = $1")
            .bind(id)
            .bind(assignee)
            .execute(&state.pool)
            .await?;
    }
    fetch_alert(&state.pool, id).await
}

async fn fetch_alert(pool: &PgPool, id: Uuid) -> Result<Json<SocAlertRow>, ApiError> {
    let row = sqlx::query_as::<_, SocAlertRow>(
        "SELECT id, rule_id, title, severity, status, assigned_to, first_seen, last_seen, event_count
         FROM soc_alerts WHERE id = $1",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|_| ApiError::not_found("alert not found"))?;
    Ok(Json(row))
}

pub async fn list_rules(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
) -> Result<Json<Vec<SocRuleRow>>, ApiError> {
    require_operator(&actor)?;
    let rows = sqlx::query_as::<_, SocRuleRow>(
        "SELECT id, name, description, enabled, severity, query_json, throttle_minutes, builtin
         FROM soc_detection_rules ORDER BY name",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

pub async fn create_rule(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
    Json(body): Json<UpsertRuleBody>,
) -> Result<Json<SocRuleRow>, ApiError> {
    require_admin(&actor)?;
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO soc_detection_rules (id, name, description, enabled, severity, query_json, throttle_minutes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(id)
    .bind(&body.name)
    .bind(body.description.as_deref().unwrap_or(""))
    .bind(body.enabled.unwrap_or(true))
    .bind(body.severity.as_deref().unwrap_or("medium"))
    .bind(&body.query_json)
    .bind(body.throttle_minutes.unwrap_or(60))
    .execute(&state.pool)
    .await?;
    fetch_rule(&state.pool, id).await
}

pub async fn patch_rule(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(body): Json<PatchRuleBody>,
) -> Result<Json<SocRuleRow>, ApiError> {
    require_admin(&actor)?;
    if let Some(enabled) = body.enabled {
        sqlx::query("UPDATE soc_detection_rules SET enabled = $2, updated_at = NOW() WHERE id = $1")
            .bind(id)
            .bind(enabled)
            .execute(&state.pool)
            .await?;
    }
    if let Some(sev) = &body.severity {
        sqlx::query("UPDATE soc_detection_rules SET severity = $2, updated_at = NOW() WHERE id = $1 AND builtin = FALSE")
            .bind(id)
            .bind(sev)
            .execute(&state.pool)
            .await?;
    }
    if let Some(q) = &body.query_json {
        sqlx::query("UPDATE soc_detection_rules SET query_json = $2, updated_at = NOW() WHERE id = $1 AND builtin = FALSE")
            .bind(id)
            .bind(q)
            .execute(&state.pool)
            .await?;
    }
    if let Some(t) = body.throttle_minutes {
        sqlx::query(
            "UPDATE soc_detection_rules SET throttle_minutes = $2, updated_at = NOW() WHERE id = $1 AND builtin = FALSE",
        )
        .bind(id)
        .bind(t)
        .execute(&state.pool)
        .await?;
    }
    fetch_rule(&state.pool, id).await
}

async fn fetch_rule(pool: &PgPool, id: Uuid) -> Result<Json<SocRuleRow>, ApiError> {
    let row = sqlx::query_as::<_, SocRuleRow>(
        "SELECT id, name, description, enabled, severity, query_json, throttle_minutes, builtin
         FROM soc_detection_rules WHERE id = $1",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|_| ApiError::not_found("rule not found"))?;
    Ok(Json(row))
}

pub async fn test_rule(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Query(q): Query<TestRuleQuery>,
) -> Result<Json<Value>, ApiError> {
    require_operator(&actor)?;
    detection::test_rule(&state.pool, id, q.hours.unwrap_or(24))
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

pub async fn asm_summary(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
) -> Result<Json<asm::AsmSummary>, ApiError> {
    require_operator(&actor)?;
    asm::build_asm_summary(&state.pool, &state.config)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

pub async fn get_splunk_integration(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
) -> Result<Json<IntegrationPublic>, ApiError> {
    require_admin(&actor)?;
    let row = fetch_integration_db(&state.pool, "splunk_hec").await?;
    Ok(Json(integration_public_db(&row)))
}

pub async fn put_splunk_integration(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
    Json(body): Json<SplunkConfigBody>,
) -> Result<Json<IntegrationPublic>, ApiError> {
    require_admin(&actor)?;
    let id = splunk_integration_id(&state.pool).await?;
    let mut cfg = serde_json::json!({
        "url": body.url,
        "token": body.token,
        "index": body.index.unwrap_or_else(|| "machina".into()),
        "sourcetype_events": body.sourcetype_events.unwrap_or_else(|| "machina:soc:ecs".into()),
        "sourcetype_alerts": body.sourcetype_alerts.unwrap_or_else(|| "machina:soc:alert".into()),
        "host": body.host.unwrap_or_default(),
    });
    if body.token.is_empty() {
        let existing: Value = sqlx::query_scalar("SELECT config_json FROM soc_integrations WHERE id = $1")
            .bind(id)
            .fetch_one(&state.pool)
            .await?;
        if let Some(t) = existing.get("token") {
            cfg["token"] = t.clone();
        }
    }
    sqlx::query(
        "UPDATE soc_integrations SET config_json = $2, enabled = $3, updated_at = NOW() WHERE id = $1",
    )
    .bind(id)
    .bind(cfg)
    .bind(body.enabled.unwrap_or(true))
    .execute(&state.pool)
    .await?;
    let row = fetch_integration_db(&state.pool, "splunk_hec").await?;
    Ok(Json(integration_public_db(&row)))
}

pub async fn test_splunk_integration(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
) -> Result<Json<Value>, ApiError> {
    require_admin(&actor)?;
    let row = fetch_integration_db(&state.pool, "splunk_hec").await?;
    splunk_hec::test_connection(&row.config_json, &state.config.controller_id)
        .await
        .map_err(|e| ApiError::bad_request(e.to_string()))
        .map(|msg| Json(serde_json::json!({ "ok": true, "message": msg })))
}

pub async fn list_integrations(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
) -> Result<Json<Vec<IntegrationPublic>>, ApiError> {
    require_admin(&actor)?;
    let rows: Vec<IntegrationDbRow> = sqlx::query_as(
        "SELECT id, integration_type, name, enabled, config_json, last_success_at, last_error
         FROM soc_integrations ORDER BY integration_type",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows.iter().map(integration_public_db).collect()))
}

pub async fn patch_integration(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
    Path(integration_type): Path<String>,
    Json(body): Json<IntegrationConfigBody>,
) -> Result<Json<IntegrationPublic>, ApiError> {
    require_admin(&actor)?;
    if let Some(cfg) = body.config_json {
        let existing: Value = sqlx::query_scalar(
            "SELECT config_json FROM soc_integrations WHERE integration_type = $1 AND name = 'default'",
        )
        .bind(&integration_type)
        .fetch_one(&state.pool)
        .await
        .unwrap_or(Value::Null);
        let merged = merge_integration_config(&existing, &cfg);
        sqlx::query(
            "UPDATE soc_integrations SET config_json = $2, updated_at = NOW() WHERE integration_type = $1 AND name = 'default'",
        )
        .bind(&integration_type)
        .bind(merged)
        .execute(&state.pool)
        .await?;
    }
    if let Some(enabled) = body.enabled {
        sqlx::query(
            "UPDATE soc_integrations SET enabled = $2, updated_at = NOW() WHERE integration_type = $1 AND name = 'default'",
        )
        .bind(&integration_type)
        .bind(enabled)
        .execute(&state.pool)
        .await?;
    }
    let row: IntegrationDbRow = fetch_integration_db(&state.pool, &integration_type).await?;
    Ok(Json(integration_public_db(&row)))
}

pub async fn test_integration(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
    Path(integration_type): Path<String>,
) -> Result<Json<Value>, ApiError> {
    require_admin(&actor)?;
    let row: IntegrationDbRow = fetch_integration_db(&state.pool, &integration_type).await?;
    let msg = match integration_type.as_str() {
        "splunk_hec" => splunk_hec::test_connection(&row.config_json, &state.config.controller_id).await?,
        "elastic_bulk" => elastic_bulk::test_connection(&row.config_json).await?,
        "sentinel_dcr" => sentinel_dcr::test_connection(&row.config_json).await?,
        "qradar_rest" => qradar_rest::test_connection(&row.config_json).await?,
        other => return Err(ApiError::bad_request(format!("unknown integration: {other}"))),
    };
    Ok(Json(serde_json::json!({ "ok": true, "message": msg })))
}

pub async fn forward_replay_handler(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
    Query(q): Query<ReplayQuery>,
) -> Result<Json<Value>, ApiError> {
    require_admin(&actor)?;
    let n = forward_replay(&state.pool, q.hours.unwrap_or(24), &state.config.controller_id)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok(Json(serde_json::json!({ "forwarded": n, "hours": q.hours.unwrap_or(24) })))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
struct IntegrationDbRow {
    id: Uuid,
    integration_type: String,
    name: String,
    enabled: bool,
    config_json: Value,
    last_success_at: Option<DateTime<Utc>>,
    last_error: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PlaybookRow {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub enabled: bool,
    pub trigger_json: Value,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PlaybookRunRow {
    pub id: Uuid,
    pub playbook_id: Uuid,
    pub alert_id: Option<Uuid>,
    pub status: String,
    pub started_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
}

pub async fn run_ingest_cycle(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
) -> Result<Json<crate::engine::soc::CycleStats>, ApiError> {
    require_admin(&actor)?;
    run_cycle(&state.pool, &state.config, &state.config.controller_id)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

pub async fn list_playbooks(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
) -> Result<Json<Vec<PlaybookRow>>, ApiError> {
    require_operator(&actor)?;
    let rows = sqlx::query_as::<_, PlaybookRow>(
        "SELECT id, name, description, enabled, trigger_json FROM soc_playbooks ORDER BY name",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

pub async fn list_playbook_runs(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<PlaybookRunRow>>, ApiError> {
    require_operator(&actor)?;
    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let rows = sqlx::query_as::<_, PlaybookRunRow>(
        "SELECT id, playbook_id, alert_id, status, started_at, finished_at
         FROM soc_playbook_runs ORDER BY started_at DESC LIMIT $1",
    )
    .bind(limit)
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

pub async fn overview(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
) -> Result<Json<Value>, ApiError> {
    require_operator(&actor)?;
    let open_alerts: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM soc_alerts WHERE status IN ('open', 'acknowledged')",
    )
    .fetch_one(&state.pool)
    .await?;
    let events_24h: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM soc_events WHERE occurred_at > NOW() - INTERVAL '24 hours'",
    )
    .fetch_one(&state.pool)
    .await?;
    let critical: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM soc_alerts WHERE status IN ('open', 'acknowledged') AND severity IN ('critical', 'high')",
    )
    .fetch_one(&state.pool)
    .await?;
    Ok(Json(serde_json::json!({
        "open_alerts": open_alerts,
        "events_24h": events_24h,
        "critical_alerts": critical,
    })))
}

#[derive(Debug, Serialize)]
pub struct IntegrationPublic {
    pub id: Uuid,
    pub integration_type: String,
    pub name: String,
    pub enabled: bool,
    pub config: Value,
    pub last_success_at: Option<DateTime<Utc>>,
    pub last_error: Option<String>,
}

fn merge_integration_config(existing: &Value, patch: &Value) -> Value {
    let mut out = patch.clone();
    let Some(patch_obj) = out.as_object_mut() else {
        return out;
    };
    let Some(existing_obj) = existing.as_object() else {
        return out;
    };
    for key in ["token", "api_key", "client_secret", "api_token", "bearer_token"] {
        let keep = patch_obj
            .get(key)
            .and_then(|v| v.as_str())
            .is_none_or(|s| s.is_empty() || s.contains('•'));
        if keep {
            if let Some(v) = existing_obj.get(key) {
                patch_obj.insert(key.to_string(), v.clone());
            }
        }
    }
    out
}

async fn fetch_integration_db(pool: &PgPool, integration_type: &str) -> Result<IntegrationDbRow, ApiError> {
    sqlx::query_as(
        "SELECT id, integration_type, name, enabled, config_json, last_success_at, last_error
         FROM soc_integrations WHERE integration_type = $1 AND name = 'default'",
    )
    .bind(integration_type)
    .fetch_one(pool)
    .await
    .map_err(|_| ApiError::not_found("integration not found"))
}

fn integration_public_db(row: &IntegrationDbRow) -> IntegrationPublic {
    IntegrationPublic {
        id: row.id,
        integration_type: row.integration_type.clone(),
        name: row.name.clone(),
        enabled: row.enabled,
        config: redact_integration_config(&row.config_json),
        last_success_at: row.last_success_at,
        last_error: row.last_error.clone(),
    }
}

fn redact_integration_config(cfg: &Value) -> Value {
    let mut cfg = cfg.clone();
    if let Some(obj) = cfg.as_object_mut() {
        for key in ["token", "api_key", "client_secret", "api_token", "bearer_token"] {
            if obj.get(key).and_then(|v| v.as_str()).is_some_and(|s| !s.is_empty()) {
                obj.insert(key.to_string(), serde_json::json!("••••••••"));
            }
        }
    }
    cfg
}

async fn splunk_integration_id(pool: &PgPool) -> Result<Uuid, ApiError> {
    sqlx::query_scalar("SELECT id FROM soc_integrations WHERE integration_type = 'splunk_hec' AND name = 'default'")
        .fetch_one(pool)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
}
