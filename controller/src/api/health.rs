// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde_json::json;

use crate::state::AppState;

pub async fn health(State(state): State<AppState>) -> Json<serde_json::Value> {
    let db_ok = sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.pool)
        .await
        .is_ok();
    Json(json!({
        "status": if db_ok { "ok" } else { "degraded" },
        "component": "machina-controller",
        "version": env!("CARGO_PKG_VERSION"),
        "controller_id": state.config.controller_id,
        "leader": state.leader.is_leader(),
        "database": if db_ok { "ok" } else { "unavailable" },
    }))
}

pub async fn ready(State(state): State<AppState>) -> Result<Json<serde_json::Value>, StatusCode> {
    sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.pool)
        .await
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
    Ok(Json(json!({ "ready": true })))
}

pub async fn openapi() -> Json<serde_json::Value> {
    Json(json!({
        "openapi": "3.0.0",
        "info": { "title": "Machina Platform API", "version": "v1" },
        "paths": {
            "/api/v1/health": { "get": { "summary": "Health check" } },
            "/api/v1/cluster": { "get": { "summary": "Cluster summary" } },
            "/api/v1/vms": { "get": { "summary": "List VMs" }, "post": { "summary": "Create VM" } },
        }
    }))
}
