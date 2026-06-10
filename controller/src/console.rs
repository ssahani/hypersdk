// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use std::net::SocketAddr;

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, Query, State};
use axum::response::IntoResponse;
use axum::Json;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio_tungstenite::{connect_async, tungstenite::Message as TsMessage};
use uuid::Uuid;

use crate::agent_client;
use crate::api::ApiError;
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct ConsoleInfo {
    pub vm_id: String,
    pub vm_name: String,
    pub console_type: String,
    pub ws_path: String,
}

#[derive(Debug, Deserialize)]
pub struct WsTokenQuery {
    pub token: String,
}

pub async fn vm_console(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ConsoleInfo>, ApiError> {
    let row: (String, Option<Uuid>) =
        sqlx::query_as("SELECT name, host_id FROM vms WHERE id = $1")
            .bind(id)
            .fetch_one(&state.pool)
            .await?;
    let host_id = row.1.ok_or_else(|| ApiError::bad_request("vm has no host"))?;
    let agent_addr = host_agent_addr(&state.pool, host_id).await?;
    let mut client = agent_client::connect(&agent_addr).await?;
    let info = agent_client::get_console(&mut client, &row.0).await.map_err(|e| {
        let msg = e.to_string();
        if msg.contains("Not found") || msg.contains("not found") {
            ApiError::not_found(format!(
                "VM '{}' is not on the hypervisor (stopped, removed, or inventory stale)",
                row.0
            ))
            .with_remediation(
                "Platform → Hosts → Sync all, then open the VM from Platform → VMs (running guests only).",
            )
        } else if msg.contains("socket is closed") {
            ApiError::internal("Host agent lost its libvirt connection")
                .with_remediation("On the host: sudo systemctl restart libvirtd machina-agent")
        } else {
            ApiError::internal(msg)
        }
    })?;
    let ws_token = state.ws_tokens.issue(id).await;
    Ok(Json(ConsoleInfo {
        vm_id: id.to_string(),
        vm_name: row.0,
        console_type: info.console_type,
        ws_path: format!("/ws/v1/platform/vnc/{id}?token={ws_token}"),
    }))
}

pub async fn issue_ws_token(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let _exists: Uuid = sqlx::query_scalar("SELECT id FROM vms WHERE id = $1")
        .bind(id)
        .fetch_one(&state.pool)
        .await?;
    let token = state.ws_tokens.issue(id).await;
    Ok(Json(serde_json::json!({ "token": token })))
}

pub async fn vnc_ws_proxy(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Path(vm_id): Path<Uuid>,
    Query(q): Query<WsTokenQuery>,
) -> impl IntoResponse {
    let validated = state.ws_tokens.validate(&q.token).await;
    if validated != Some(vm_id) {
        return (axum::http::StatusCode::UNAUTHORIZED, "invalid token").into_response();
    }
    ws.on_upgrade(move |socket| proxy_to_agent(socket, state, vm_id))
}

async fn proxy_to_agent(socket: WebSocket, state: AppState, vm_id: Uuid) {
    let row: Option<(String, Option<Uuid>)> = sqlx::query_as(
        "SELECT name, host_id FROM vms WHERE id = $1",
    )
    .bind(vm_id)
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();

    let Some((name, Some(host_id))) = row else {
        let (mut sink, _) = socket.split();
        let _ = sink.close().await;
        return;
    };

    let agent_console = match host_console_addr(&state.pool, host_id).await {
        Ok(a) => a,
        Err(_) => {
            let (mut sink, _) = socket.split();
            let _ = sink.close().await;
            return;
        }
    };

    let ws_url = format!(
        "ws://{}/ws/vnc/{}",
        agent_client::normalize_agent_addr(&agent_console),
        name
    );

    let agent_ws = match connect_async(&ws_url).await {
        Ok((stream, _)) => stream,
        Err(_) => {
            let (mut sink, _) = socket.split();
            let _ = sink.close().await;
            return;
        }
    };

    let (mut client_sink, mut client_stream) = socket.split();
    let (mut agent_sink, mut agent_stream) = agent_ws.split();

    let c2a = tokio::spawn(async move {
        while let Some(Ok(msg)) = client_stream.next().await {
            match msg {
                Message::Binary(b) => {
                    if agent_sink
                        .send(TsMessage::Binary(bytes::Bytes::from(b.to_vec())))
                        .await
                        .is_err()
                    {
                        break;
                    }
                }
                Message::Close(_) => {
                    let _ = agent_sink.send(TsMessage::Close(None)).await;
                    break;
                }
                _ => {}
            }
        }
    });

    let a2c = tokio::spawn(async move {
        while let Some(Ok(msg)) = agent_stream.next().await {
            match msg {
                TsMessage::Binary(b) => {
                    if client_sink.send(Message::Binary(b.into())).await.is_err() {
                        break;
                    }
                }
                TsMessage::Close(_) => {
                    let _ = client_sink.send(Message::Close(None)).await;
                    break;
                }
                _ => {}
            }
        }
    });

    tokio::select! {
        _ = c2a => {},
        _ = a2c => {},
    }
}

async fn host_agent_addr(pool: &sqlx::PgPool, host_id: Uuid) -> Result<String, ApiError> {
    let addr: String = sqlx::query_scalar("SELECT agent_grpc_addr FROM hosts WHERE id = $1")
        .bind(host_id)
        .fetch_one(pool)
        .await?;
    Ok(addr)
}

async fn host_console_addr(pool: &sqlx::PgPool, host_id: Uuid) -> Result<String, ApiError> {
    let addr: String = sqlx::query_scalar(
        "SELECT COALESCE(NULLIF(agent_console_addr, ''), agent_grpc_addr) FROM hosts WHERE id = $1",
    )
    .bind(host_id)
    .fetch_one(pool)
    .await?;
    Ok(addr)
}

pub fn ws_routes() -> axum::Router<AppState> {
    use axum::routing::get;
    axum::Router::new().route("/ws/v1/platform/vnc/{vm_id}", get(vnc_ws_proxy))
}
