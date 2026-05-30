// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::extract::{Path, State};
use axum::Extension;
use axum::Json;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api::ApiError;
use crate::auth::AuthUser;
use crate::state::AppState;
use crate::tasks::enqueue::enqueue_task;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct NetworkRow {
    pub id: Uuid,
    pub name: String,
    pub backend: String,
    pub vlan_id: Option<i32>,
    pub bridge: Option<String>,
    pub segment_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateNetworkBody {
    pub name: String,
    #[serde(default = "default_backend")]
    pub backend: String,
    pub vlan_id: Option<i32>,
    pub bridge: Option<String>,
    #[serde(default)]
    pub host_id: Option<Uuid>,
    #[serde(default)]
    pub segment_id: Option<Uuid>,
    pub firewall_profile: Option<String>,
}

fn default_backend() -> String {
    "linux-bridge".into()
}

pub async fn list_networks(
    State(state): State<AppState>,
) -> Result<Json<Vec<NetworkRow>>, ApiError> {
    let rows = sqlx::query_as::<_, NetworkRow>(
        "SELECT id, name, backend, vlan_id, bridge, segment_id FROM networks ORDER BY name",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

pub async fn create_network(
    State(state): State<AppState>,
    Extension(_actor): Extension<AuthUser>,
    Json(body): Json<CreateNetworkBody>,
) -> Result<Json<NetworkRow>, ApiError> {
    machina_spec::validate_name(&body.name).map_err(|e| ApiError::bad_request(e.to_string()))?;
    let cluster_id: Uuid = sqlx::query_scalar("SELECT id FROM clusters LIMIT 1")
        .fetch_one(&state.pool)
        .await?;
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO networks (id, cluster_id, name, backend, vlan_id, bridge, segment_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(id)
    .bind(cluster_id)
    .bind(&body.name)
    .bind(&body.backend)
    .bind(body.vlan_id)
    .bind(&body.bridge)
    .bind(body.segment_id)
    .execute(&state.pool)
    .await?;

    if let Some(seg_id) = body.segment_id {
        if let Some(prof) = body.firewall_profile.as_deref() {
            sqlx::query(
                "UPDATE network_segments SET firewall_profile = COALESCE($1, firewall_profile) WHERE id = $2",
            )
            .bind(prof)
            .bind(seg_id)
            .execute(&state.pool)
            .await?;
        }
    }

    let row = sqlx::query_as::<_, NetworkRow>(
        "SELECT id, name, backend, vlan_id, bridge, segment_id FROM networks WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await?;

    let host_id = match body.host_id {
        Some(h) => h,
        None => sqlx::query_scalar("SELECT id FROM hosts WHERE state = 'online' ORDER BY hostname LIMIT 1")
            .fetch_optional(&state.pool)
            .await?
            .ok_or_else(|| ApiError::bad_request("no online host for network provisioning"))?,
    };
    let _ = enqueue_task(
        &state,
        "network.provision",
        serde_json::json!({
            "network_id": id.to_string(),
            "host_id": host_id.to_string(),
        }),
        Some("network"),
        Some(id),
        Some(host_id),
    )
    .await?;

    Ok(Json(row))
}

pub async fn discover_networks(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let imported = crate::engine::network_sync::discover_all_online(&state.pool)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))?;
    let rows = sqlx::query_as::<_, NetworkRow>(
        "SELECT id, name, backend, vlan_id, bridge, segment_id FROM networks ORDER BY name",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(serde_json::json!({
        "imported": imported,
        "networks": rows,
    })))
}

#[derive(Debug, Deserialize)]
pub struct PatchNetworkBody {
    pub vlan_id: Option<i32>,
    pub bridge: Option<String>,
    pub segment_id: Option<Uuid>,
}

pub async fn patch_network(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<PatchNetworkBody>,
) -> Result<Json<NetworkRow>, ApiError> {
    if let Some(v) = body.vlan_id {
        sqlx::query("UPDATE networks SET vlan_id = $1 WHERE id = $2")
            .bind(v)
            .bind(id)
            .execute(&state.pool)
            .await?;
    }
    if let Some(v) = &body.bridge {
        sqlx::query("UPDATE networks SET bridge = $1 WHERE id = $2")
            .bind(v)
            .bind(id)
            .execute(&state.pool)
            .await?;
    }
    if let Some(seg) = body.segment_id {
        crate::engine::network_overlay::bind_network(&state.pool, id, seg)
            .await
            .map_err(|e| ApiError::bad_request(e.to_string()))?;
    }
    let row = sqlx::query_as::<_, NetworkRow>(
        "SELECT id, name, backend, vlan_id, bridge, segment_id FROM networks WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await?;
    Ok(Json(row))
}

pub async fn delete_network(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    sqlx::query("DELETE FROM networks WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}
