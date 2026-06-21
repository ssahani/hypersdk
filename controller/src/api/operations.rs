// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::extract::{Path, Query, State};
use axum::Extension;
use axum::Json;

use crate::api::ApiError;
use crate::auth::AuthUser;
use crate::engine::operations::{self, ExecuteRunbookRequest};
use crate::state::AppState;

#[derive(Debug, serde::Deserialize)]
pub struct ExecutionsQuery {
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    20
}

pub async fn overview(
    State(state): State<AppState>,
) -> Result<Json<operations::OperationsOverview>, ApiError> {
    operations::overview(&state.pool)
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

pub async fn list_runbooks(
    State(state): State<AppState>,
) -> Result<Json<Vec<operations::RunbookCatalogRow>>, ApiError> {
    operations::list_catalog(&state.pool)
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

pub async fn list_executions(
    State(state): State<AppState>,
    Query(q): Query<ExecutionsQuery>,
) -> Result<Json<Vec<operations::RunbookExecutionRow>>, ApiError> {
    operations::list_executions(&state.pool, q.limit)
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}

pub async fn execute_runbook(
    State(state): State<AppState>,
    Extension(actor): Extension<AuthUser>,
    Path(incident): Path<String>,
    Json(body): Json<ExecuteRunbookRequest>,
) -> Result<Json<operations::RunbookExecuteResult>, ApiError> {
    crate::auth::require_operator(&actor)?;
    operations::execute_runbook(&state.pool, &incident, &actor.username, &body.context)
        .await
        .map(Json)
        .map_err(|e| ApiError::bad_request(e.to_string()))
}

pub async fn showback_overview(
    State(state): State<AppState>,
) -> Result<Json<operations::ShowbackOverview>, ApiError> {
    operations::showback_overview(&state.pool, &state.config)
        .await
        .map(Json)
        .map_err(|e| ApiError::internal(e.to_string()))
}
