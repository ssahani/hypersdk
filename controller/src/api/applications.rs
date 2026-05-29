// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::extract::{Path, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api::ApiError;
use crate::state::AppState;
use crate::tasks::enqueue::enqueue_task;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ApplicationGroupRow {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct ApplicationGroupDetail {
    #[serde(flatten)]
    pub group: ApplicationGroupRow,
    pub vm_ids: Vec<Uuid>,
    pub vm_names: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateApplicationBody {
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub vm_ids: Vec<Uuid>,
}

pub async fn list_applications(
    State(state): State<AppState>,
) -> Result<Json<Vec<ApplicationGroupRow>>, ApiError> {
    let rows = sqlx::query_as::<_, ApplicationGroupRow>(
        "SELECT id, name, description, created_at FROM application_groups ORDER BY name",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(rows))
}

pub async fn get_application(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ApplicationGroupDetail>, ApiError> {
    let group = sqlx::query_as::<_, ApplicationGroupRow>(
        "SELECT id, name, description, created_at FROM application_groups WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| ApiError::not_found("application not found"))?;

    let vms: Vec<(Uuid, String)> = sqlx::query_as(
        "SELECT v.id, v.name FROM application_group_vms agv
         JOIN vms v ON v.id = agv.vm_id WHERE agv.group_id = $1 ORDER BY v.name",
    )
    .bind(id)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(ApplicationGroupDetail {
        vm_ids: vms.iter().map(|(id, _)| *id).collect(),
        vm_names: vms.iter().map(|(_, n)| n.clone()).collect(),
        group,
    }))
}

pub async fn create_application(
    State(state): State<AppState>,
    Json(body): Json<CreateApplicationBody>,
) -> Result<Json<ApplicationGroupDetail>, ApiError> {
    let name = body.name.trim();
    machina_spec::validate_label(name).map_err(|e| ApiError::bad_request(e.to_string()))?;
    let cluster_id: Uuid = sqlx::query_scalar("SELECT id FROM clusters LIMIT 1")
        .fetch_one(&state.pool)
        .await?;
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO application_groups (id, cluster_id, name, description) VALUES ($1, $2, $3, $4)",
    )
    .bind(id)
    .bind(cluster_id)
    .bind(name)
    .bind(body.description.trim())
    .execute(&state.pool)
    .await?;
    for vm_id in &body.vm_ids {
        sqlx::query("INSERT INTO application_group_vms (group_id, vm_id) VALUES ($1, $2) ON CONFLICT DO NOTHING")
            .bind(id)
            .bind(vm_id)
            .execute(&state.pool)
            .await?;
    }
    get_application(State(state), Path(id)).await
}

#[derive(Debug, Deserialize)]
pub struct ApplicationActionBody {
    pub action: String,
}

pub async fn run_application_action(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<ApplicationActionBody>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let vm_ids: Vec<Uuid> = sqlx::query_scalar(
        "SELECT vm_id FROM application_group_vms WHERE group_id = $1",
    )
    .bind(id)
    .fetch_all(&state.pool)
    .await?;
    if vm_ids.is_empty() {
        return Err(ApiError::bad_request("application group has no VMs"));
    }
    let mut task_ids = Vec::new();
    for vm_id in vm_ids {
        let host_id: Option<Uuid> = sqlx::query_scalar("SELECT host_id FROM vms WHERE id = $1")
            .bind(vm_id)
            .fetch_optional(&state.pool)
            .await?
            .flatten();
        let (op, payload) = match body.action.as_str() {
            "start" => ("vm.power", serde_json::json!({ "vm_id": vm_id.to_string(), "action": "start" })),
            "stop" => ("vm.power", serde_json::json!({ "vm_id": vm_id.to_string(), "action": "stop" })),
            "backup" => ("vm.backup", serde_json::json!({ "vm_id": vm_id.to_string(), "backup_type": "full" })),
            other => return Err(ApiError::bad_request(format!("unknown action: {other}"))),
        };
        let task_id = enqueue_task(
            &state,
            op,
            payload,
            Some("vm"),
            Some(vm_id),
            host_id,
        )
        .await?;
        task_ids.push(task_id.to_string());
    }
    Ok(Json(serde_json::json!({ "task_ids": task_ids })))
}
