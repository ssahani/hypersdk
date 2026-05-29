// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use std::convert::Infallible;
use std::time::Duration;

use axum::extract::{Query, State};
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::Extension;
use axum::Json;
use futures_util::stream::Stream;
use serde::Deserialize;
use tokio_stream::wrappers::ReceiverStream;
use uuid::Uuid;

use crate::api::ApiError;
use crate::auth::AuthUser;
use crate::engine::ai;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct SpotlightBody {
    pub query: String,
}

pub async fn get_settings(State(state): State<AppState>) -> Result<Json<ai::settings::AiSettings>, ApiError> {
    ai::settings::get_ai_settings(&state.pool)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

pub async fn patch_settings(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
    Json(body): Json<ai::settings::AiSettingsPatch>,
) -> Result<Json<ai::settings::AiSettings>, ApiError> {
    crate::auth::require_admin(&actor)?;
    ai::settings::patch_ai_settings(&state.pool, &body)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

pub async fn spotlight(
    State(state): State<AppState>,
    Json(body): Json<SpotlightBody>,
) -> Result<Json<ai::SpotlightResult>, ApiError> {
    let online: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM hosts WHERE state = 'online'")
            .fetch_one(&state.pool)
            .await
            .map_err(|e| ApiError::internal(e.to_string()))?;

    let q = body.query.trim();
    let mut hits = Vec::new();
    if !q.is_empty() {
        let vms: Vec<(Uuid, String, String)> = sqlx::query_as(
            "SELECT id, name, observed_state FROM vms WHERE name ILIKE $1 ORDER BY name LIMIT 12",
        )
        .bind(format!("%{q}%"))
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();
        for (id, name, st) in vms {
            hits.push(ai::SearchHit {
                kind: "vm".into(),
                id: id.to_string(),
                label: name,
                sublabel: Some(st),
            });
        }
    }

    Ok(Json(ai::intent_router::route_spotlight(&body.query, online, hits)))
}

#[derive(Debug, Deserialize)]
pub struct CopilotBody {
    pub message: String,
    pub vm_id: Option<Uuid>,
}

pub async fn copilot_chat(
    State(state): State<AppState>,
    Json(body): Json<CopilotBody>,
) -> Result<Json<ai::CopilotResponse>, ApiError> {
    ai::copilot_chat(&state.pool, &body.message, body.vm_id)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

pub async fn copilot_stream(
    State(state): State<AppState>,
    Json(body): Json<CopilotBody>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let (tx, rx) = tokio::sync::mpsc::channel::<Result<Event, Infallible>>(64);
    let pool = state.pool.clone();
    let message = body.message;
    let vm_id = body.vm_id;

    tokio::spawn(async move {
        let send = |data: String| async {
            let _ = tx
                .send(Ok(Event::default().data(data)))
                .await;
        };

        match ai::build_copilot_base(&pool, &message, vm_id).await {
            Ok(base) => {
                for chunk in ai::chunk_text(&base.reply, 48) {
                    let payload = serde_json::json!({ "type": "chunk", "text": chunk }).to_string();
                    send(payload).await;
                    tokio::time::sleep(Duration::from_millis(10)).await;
                }

                let system =
                    "You are Machina Copilot, an infrastructure assistant. Be concise. Use bullet points.";
                let mut deterministic = true;
                if let Ok(Some(llm_text)) = ai::llm::complete(
                    &pool,
                    system,
                    &format!("Context: {}\nUser: {}", base.ctx_json, message),
                )
                .await
                {
                    deterministic = false;
                    send(serde_json::json!({ "type": "chunk", "text": "\n\n" }).to_string()).await;
                    for chunk in ai::chunk_text(&llm_text, 48) {
                        let payload =
                            serde_json::json!({ "type": "chunk", "text": chunk }).to_string();
                        send(payload).await;
                        tokio::time::sleep(Duration::from_millis(10)).await;
                    }
                }

                let done = serde_json::json!({
                    "type": "done",
                    "deterministic": deterministic,
                    "context_summary": base.context_summary,
                })
                .to_string();
                send(done).await;
            }
            Err(e) => {
                let err = serde_json::json!({ "type": "error", "message": e.to_string() }).to_string();
                send(err).await;
            }
        }
    });

    Sse::new(ReceiverStream::new(rx)).keep_alive(KeepAlive::new().interval(Duration::from_secs(15)))
}

#[derive(Debug, Deserialize)]
pub struct ExplainBody {
    pub screen: String,
    #[serde(default)]
    pub object_ref: serde_json::Value,
}

pub async fn explain(
    State(state): State<AppState>,
    Json(body): Json<ExplainBody>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let text = ai::explain_screen(&state.pool, &body.screen, &body.object_ref)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok(Json(serde_json::json!({ "explanation": text })))
}

#[derive(Debug, Deserialize)]
pub struct RunbookBody {
    pub incident: String,
    #[serde(default)]
    pub context: serde_json::Value,
}

pub async fn runbook(
    State(state): State<AppState>,
    Json(body): Json<RunbookBody>,
) -> Result<Json<ai::runbook::Runbook>, ApiError> {
    ai::runbook::generate(&state.pool, &body.incident, &body.context)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

#[derive(Debug, Deserialize)]
pub struct BlueprintGenBody {
    pub prompt: String,
}

pub async fn generate_blueprint(
    Json(body): Json<BlueprintGenBody>,
) -> Result<Json<ai::blueprint::GeneratedBlueprint>, ApiError> {
    Ok(Json(ai::blueprint::generate_from_nl(&body.prompt)))
}

pub async fn cost_guardian(
    State(state): State<AppState>,
) -> Result<Json<ai::cost::CostAnalysis>, ApiError> {
    ai::cost::analyze(&state.pool)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

pub async fn capacity_planner(
    State(state): State<AppState>,
) -> Result<Json<ai::capacity::CapacityPlan>, ApiError> {
    ai::capacity::plan(&state.pool)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

pub async fn security_sentinel(
    State(state): State<AppState>,
) -> Result<Json<ai::security::SecurityReport>, ApiError> {
    ai::security::scan(&state.pool)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

#[derive(Debug, Deserialize)]
pub struct NetworkExplainBody {
    pub vm_a: String,
    pub vm_b: String,
    pub port: Option<i32>,
}

pub async fn policy_export(
    State(state): State<AppState>,
) -> Result<Json<ai::policy_export::PolicyExport>, ApiError> {
    ai::policy_export::export_policy_yaml(&state.pool)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

pub async fn network_explain(
    State(state): State<AppState>,
    Json(body): Json<NetworkExplainBody>,
) -> Result<Json<ai::network::NetworkExplainResult>, ApiError> {
    ai::network::explain_reach(&state.pool, &body.vm_a, &body.vm_b, body.port)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

#[derive(Debug, Deserialize)]
pub struct MigrationAdvisorQuery {
    pub provider: Option<String>,
    pub vm: String,
    pub os: Option<String>,
    #[serde(default)]
    pub has_rdm: bool,
}

pub async fn migration_advisor(
    Query(q): Query<MigrationAdvisorQuery>,
) -> Result<Json<ai::migration::MigrationAdvisorReport>, ApiError> {
    let provider = q.provider.as_deref().unwrap_or("vmware");
    if provider == "vmware" {
        Ok(Json(ai::migration::advise_vmware_vm(
            &q.vm,
            q.os.as_deref().unwrap_or("linux"),
            q.has_rdm,
        )))
    } else {
        Ok(Json(ai::migration::advise_vmware_vm(&q.vm, "linux", false)))
    }
}

pub async fn vm_doctor(
    State(state): State<AppState>,
    axum::extract::Path(id): axum::extract::Path<Uuid>,
) -> Result<Json<crate::engine::vm_health::VmHealthReport>, ApiError> {
    crate::engine::vm_health::run_vm_health_check(&state.pool, id)
        .await
        .map_err(|e| ApiError::bad_request(e.to_string()))
        .map(Json)
}

#[derive(Debug, Deserialize)]
pub struct AutopilotProposeQuery {
    pub vm_id: Option<Uuid>,
}

pub async fn autopilot_propose(
    State(state): State<AppState>,
    Query(q): Query<AutopilotProposeQuery>,
) -> Result<Json<ai::autopilot::AutopilotProposal>, ApiError> {
    ai::autopilot::propose(&state.pool, q.vm_id)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

pub async fn autopilot_execute(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
    Json(body): Json<ai::autopilot::ExecuteBody>,
) -> Result<Json<ai::autopilot::ExecuteResult>, ApiError> {
    ai::autopilot::execute(&state, &actor, &body)
        .await
        .map(Json)
}

pub async fn compliance_report(
    State(state): State<AppState>,
) -> Result<Json<ai::compliance::ComplianceReport>, ApiError> {
    ai::compliance::generate(&state.pool)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

pub async fn compliance_export_html(
    State(state): State<AppState>,
) -> Result<axum::response::Html<String>, ApiError> {
    let report = ai::compliance::generate(&state.pool)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok(axum::response::Html(ai::compliance::report_to_html(&report)))
}

pub async fn compliance_export_pdf(
    State(state): State<AppState>,
) -> Result<axum::response::Response, ApiError> {
    let report = ai::compliance::generate(&state.pool)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))?;
    let bytes = ai::compliance::report_to_pdf(&report);
    Ok(axum::response::Response::builder()
        .header(http::header::CONTENT_TYPE, "application/pdf")
        .header(
            http::header::CONTENT_DISPOSITION,
            "attachment; filename=\"machina-compliance-report.pdf\"",
        )
        .body(axum::body::Body::from(bytes))
        .map_err(|e| ApiError::internal(e.to_string()))?)
}

#[derive(Debug, Deserialize)]
pub struct TerminalSuggestBody {
    pub vm_id: Option<Uuid>,
    pub vm_name: Option<String>,
}

pub async fn terminal_suggest(
    State(state): State<AppState>,
    Json(body): Json<TerminalSuggestBody>,
) -> Result<Json<ai::terminal::TerminalSuggestResult>, ApiError> {
    ai::terminal::suggest(
        &state.pool,
        body.vm_id,
        body.vm_name.as_deref(),
    )
    .await
    .map_err(|e| ApiError::internal(e.to_string()))
    .map(Json)
}

#[derive(Debug, Deserialize)]
pub struct AutopilotRunBody {
    #[serde(default)]
    pub vm_id: Option<Uuid>,
    #[serde(default = "default_max_actions")]
    pub max_actions: usize,
}

fn default_max_actions() -> usize {
    3
}

pub async fn autopilot_run(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
    Json(body): Json<AutopilotRunBody>,
) -> Result<Json<ai::autopilot::AutopilotRunResult>, ApiError> {
    let settings = ai::settings::get_ai_settings(&state.pool)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))?;
    let cap = settings.autopilot_max_actions.clamp(1, 10) as usize;
    let max = if body.max_actions == default_max_actions() {
        cap
    } else {
        body.max_actions.min(cap)
    };
    ai::autopilot::run_safe_batch(&state, &actor, body.vm_id, max)
        .await
        .map(Json)
}

#[derive(Debug, Deserialize)]
pub struct AutopilotHistoryQuery {
    #[serde(default = "default_history_limit")]
    pub limit: i64,
}

fn default_history_limit() -> i64 {
    20
}

pub async fn autopilot_history(
    State(state): State<AppState>,
    Query(q): Query<AutopilotHistoryQuery>,
) -> Result<Json<Vec<ai::autopilot::AutopilotHistoryEntry>>, ApiError> {
    ai::autopilot::list_history(&state.pool, q.limit)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

pub async fn capacity_export_csv(
    State(state): State<AppState>,
) -> Result<axum::response::Response, ApiError> {
    let csv = ai::capacity::export_csv(&state.pool)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok(axum::response::Response::builder()
        .header(http::header::CONTENT_TYPE, "text/csv; charset=utf-8")
        .header(
            http::header::CONTENT_DISPOSITION,
            "attachment; filename=\"machina-capacity-planner.csv\"",
        )
        .body(axum::body::Body::from(csv))
        .map_err(|e| ApiError::internal(e.to_string()))?)
}

pub async fn cost_export_csv(
    State(state): State<AppState>,
) -> Result<axum::response::Response, ApiError> {
    let csv = ai::cost::export_csv(&state.pool)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok(axum::response::Response::builder()
        .header(http::header::CONTENT_TYPE, "text/csv; charset=utf-8")
        .header(
            http::header::CONTENT_DISPOSITION,
            "attachment; filename=\"machina-cost-guardian.csv\"",
        )
        .body(axum::body::Body::from(csv))
        .map_err(|e| ApiError::internal(e.to_string()))?)
}

pub async fn fleet_summary(
    State(state): State<AppState>,
) -> Result<Json<ai::fleet_summary::FleetZeusSummary>, ApiError> {
    ai::fleet_summary::summarize(&state.pool)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

pub async fn fleet_local(
    State(state): State<AppState>,
) -> Result<Json<ai::fleet_summary::FleetClusterSlice>, ApiError> {
    ai::fleet_summary::local_export(&state.pool)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

pub async fn twin_graph(
    State(state): State<AppState>,
) -> Result<Json<ai::digital_twin::DigitalTwinGraph>, ApiError> {
    ai::digital_twin::build_graph(&state.pool)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

pub async fn twin_impact(
    State(state): State<AppState>,
    Json(body): Json<ai::digital_twin::ImpactRequest>,
) -> Result<Json<ai::digital_twin::ImpactAnalysis>, ApiError> {
    ai::digital_twin::analyze_impact(&state.pool, &body)
        .await
        .map_err(|e| ApiError::bad_request(e.to_string()))
        .map(Json)
}

pub async fn analyze_incident(
    State(state): State<AppState>,
    Query(q): Query<ai::root_cause::AnalyzeIncidentQuery>,
) -> Result<Json<ai::root_cause::IncidentAnalysis>, ApiError> {
    ai::root_cause::analyze(&state.pool, &q)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

#[derive(Debug, Deserialize)]
pub struct EnvironmentIntentBody {
    pub query: String,
}

pub async fn intent_environment(
    State(state): State<AppState>,
    Json(body): Json<EnvironmentIntentBody>,
) -> Result<Json<ai::environment_intent::EnvironmentResourcePlan>, ApiError> {
    let rates: (f64, f64) = sqlx::query_as(
        "SELECT finops_vcpu_hour_usd, finops_gib_hour_usd FROM clusters ORDER BY created_at LIMIT 1",
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok(Json(ai::environment_intent::plan_environment(
        &body.query,
        rates.0,
        rates.1,
    )))
}

pub async fn sre_forecast(
    State(state): State<AppState>,
) -> Result<Json<ai::sre_predict::SreForecastReport>, ApiError> {
    ai::sre_predict::forecast(&state.pool)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

pub async fn fleet_heatmap(
    State(state): State<AppState>,
) -> Result<Json<ai::fleet_heatmap::FleetHeatmap>, ApiError> {
    ai::fleet_heatmap::heatmap(&state.pool)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

#[derive(Debug, Deserialize)]
pub struct RebalanceQuery {
    #[serde(default = "default_rebalance_max")]
    pub max_moves: usize,
}

fn default_rebalance_max() -> usize {
    5
}

pub async fn fleet_rebalance_propose(
    State(state): State<AppState>,
    Query(q): Query<RebalanceQuery>,
) -> Result<Json<ai::fleet_rebalance::RebalanceProposal>, ApiError> {
    ai::fleet_rebalance::propose(&state.pool, q.max_moves)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

pub async fn security_graph(
    State(state): State<AppState>,
) -> Result<Json<ai::security_graph::SecurityGraph>, ApiError> {
    ai::security_graph::build_graph(&state.pool)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

pub async fn security_attack_path(
    State(state): State<AppState>,
    Json(body): Json<ai::security_graph::AttackPathQuery>,
) -> Result<Json<ai::security_graph::AttackPathResult>, ApiError> {
    ai::security_graph::attack_path(&state.pool, &body)
        .await
        .map_err(|e| ApiError::bad_request(e.to_string()))
        .map(Json)
}

#[derive(Debug, Deserialize)]
pub struct KnowledgeSearchBody {
    pub query: String,
}

pub async fn knowledge_search(
    State(state): State<AppState>,
    Json(body): Json<KnowledgeSearchBody>,
) -> Result<Json<ai::knowledge_search::KnowledgeSearchResult>, ApiError> {
    ai::knowledge_search::search(&state.pool, &body.query)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

pub async fn service_graph(
    State(state): State<AppState>,
) -> Result<Json<ai::service_graph::ServiceGraph>, ApiError> {
    ai::service_graph::build(&state.pool)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

#[derive(Debug, Deserialize)]
pub struct MemoryQuery {
    #[serde(default = "default_memory_limit")]
    pub limit: i64,
}

fn default_memory_limit() -> i64 {
    20
}

pub async fn infrastructure_memory(
    State(state): State<AppState>,
    Query(q): Query<MemoryQuery>,
) -> Result<Json<ai::infrastructure_memory::InfrastructureMemory>, ApiError> {
    ai::infrastructure_memory::recall(&state.pool, q.limit)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))
        .map(Json)
}

#[derive(Debug, Deserialize)]
pub struct MissionStackBody {
    pub query: String,
}

pub async fn mission_stack(
    State(state): State<AppState>,
    Json(body): Json<MissionStackBody>,
) -> Result<Json<ai::mission_stack::MissionStackPlan>, ApiError> {
    let rates: (f64, f64) = sqlx::query_as(
        "SELECT finops_vcpu_hour_usd, finops_gib_hour_usd FROM clusters ORDER BY created_at LIMIT 1",
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok(Json(ai::mission_stack::plan_mission_stack(
        &body.query,
        rates.0,
        rates.1,
    )))
}
