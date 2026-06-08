// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

use crate::api::ApiError;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct LibvirtActionBody {
    pub action: String,
    #[serde(default)]
    pub payload: Value,
}

#[derive(Debug, Deserialize)]
pub struct LibvirtQueryParams {
    pub action: String,
    #[serde(default)]
    pub disk: Option<String>,
    #[serde(default)]
    pub bandwidth_bytes: Option<bool>,
}

async fn vm_agent_row(
    state: &AppState,
    vm_id: Uuid,
) -> Result<(String, Uuid), ApiError> {
    let row: (String, Option<Uuid>, String) = sqlx::query_as(
        "SELECT name, host_id, COALESCE(inventory_source, 'libvirt') FROM vms WHERE id = $1",
    )
    .bind(vm_id)
    .fetch_one(&state.pool)
    .await?;
    if row.2 == "kubevirt" {
        return Err(ApiError::bad_request(
            "Libvirt operations apply to libvirt-managed VMs only",
        ));
    }
    let host_id = row
        .1
        .ok_or_else(|| ApiError::bad_request("VM has no host assigned"))?;
    Ok((row.0, host_id))
}

pub async fn query_vm_libvirt(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(q): Query<LibvirtQueryParams>,
) -> Result<Json<Value>, ApiError> {
    let (name, host_id) = vm_agent_row(&state, id).await?;
    let (_, agent_addr) = crate::engine::host_os::resolve_agent_addr(&state.pool, &state.config, host_id)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))?;
    let mut client = crate::agent_client::connect(&agent_addr)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))?;
    let mut payload = serde_json::json!({});
    if let Some(disk) = q.disk {
        payload["disk"] = serde_json::Value::String(disk);
    }
    if let Some(bb) = q.bandwidth_bytes {
        payload["bandwidth_bytes"] = serde_json::Value::Bool(bb);
    }
    let result = crate::agent_client::vm_libvirt_query(&mut client, &name, &q.action, &payload)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok(Json(result))
}

pub async fn invoke_vm_libvirt(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<LibvirtActionBody>,
) -> Result<Json<Value>, ApiError> {
    let (name, host_id) = vm_agent_row(&state, id).await?;
    let (_, agent_addr) = crate::engine::host_os::resolve_agent_addr(&state.pool, &state.config, host_id)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))?;
    let mut client = crate::agent_client::connect(&agent_addr)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))?;
    let result =
        crate::agent_client::vm_libvirt_invoke(&mut client, &name, &body.action, &body.payload)
            .await
            .map_err(|e| ApiError::internal(e.to_string()))?;
    state.emit_event(
        "vm.libvirt",
        format!("VM {name} libvirt action {}", body.action),
    );
    Ok(Json(result))
}

#[derive(Debug, Deserialize)]
pub struct PutDomainXmlBody {
    pub xml: String,
}

pub async fn put_vm_domain_xml(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<PutDomainXmlBody>,
) -> Result<Json<Value>, ApiError> {
    let (name, host_id) = vm_agent_row(&state, id).await?;
    let (_, agent_addr) = crate::engine::host_os::resolve_agent_addr(&state.pool, &state.config, host_id)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))?;
    let mut client = crate::agent_client::connect(&agent_addr)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))?;
    let result = crate::agent_client::vm_libvirt_invoke(
        &mut client,
        &name,
        "domain.xml.update",
        &serde_json::json!({ "xml": body.xml }),
    )
    .await
    .map_err(|e| ApiError::internal(e.to_string()))?;
    state.emit_event("vm.xml", format!("Updated domain XML for {name}"));
    Ok(Json(result))
}

#[derive(Debug, Deserialize)]
pub struct HostLibvirtQueryParams {
    pub action: String,
}

pub async fn query_host_libvirt(
    State(state): State<AppState>,
    Path(host_id): Path<Uuid>,
    Query(q): Query<HostLibvirtQueryParams>,
) -> Result<Json<Value>, ApiError> {
    let (_, agent_addr) = crate::engine::host_os::resolve_agent_addr(&state.pool, &state.config, host_id)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))?;
    let mut client = crate::agent_client::connect(&agent_addr)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))?;
    let result = crate::agent_client::host_libvirt_query(
        &mut client,
        &q.action,
        &serde_json::json!({}),
    )
    .await
    .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok(Json(result))
}
