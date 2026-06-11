// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

//! Zeus ConsoleHub — unified console plan, Guacamole sessions, same-origin reverse proxy.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::body::Body;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Extension, Path, State};
use axum::http::{HeaderMap, HeaderValue, Method, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{any, get, post};
use axum::{Json, Router};
use futures_util::{SinkExt, StreamExt};
use libvirt_guac_bridge::{bridge_from_plan, GuacBridgeTarget, GuacamoleBridgeParams};
use serde::{Deserialize, Serialize};
use sqlx::types::Json as SqlxJson;
use machina_spec::VirtualMachine;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::agent_client;
use crate::api::ApiError;
use crate::auth::AuthUser;
use crate::state::AppState;

#[derive(Clone)]
pub struct ConsoleSessionStore {
    inner: Arc<RwLock<HashMap<Uuid, LiveConsoleSession>>>,
}

#[derive(Clone)]
struct LiveConsoleSession {
    vm_id: Uuid,
    actor: String,
    protocol: String,
    backend: String,
    guac_token: Option<String>,
    agent_proxy_base: String,
    emergency_url: Option<String>,
    expires: Instant,
    audit_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct GuestAccessHints {
    /// ssh_key | password | both | unknown
    pub auth_mode: String,
    pub serial_password_login: bool,
    pub guest_ip_private: bool,
    pub ssh_nat_host_port: Option<u16>,
}

#[derive(Debug, Serialize)]
pub struct ConsoleHubPlan {
    pub vm_id: String,
    pub vm_name: String,
    pub recommended: String,
    pub native: NativeConsoleInfo,
    pub guacamole: GuacamoleConsoleInfo,
    pub guest_ip: Option<String>,
    pub ssh_user: Option<String>,
    pub os_hint: String,
    pub protocols: Vec<String>,
    pub webrtc_spice_available: bool,
    pub guest_access: GuestAccessHints,
}

#[derive(Debug, Serialize)]
pub struct NativeConsoleInfo {
    pub console_type: String,
    pub ws_path: String,
    pub serial_ws_path: String,
    pub available: bool,
}

#[derive(Debug, Serialize)]
pub struct GuacamoleConsoleInfo {
    pub available: bool,
    pub protocols: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSessionBody {
    pub protocol: Option<String>,
    #[serde(default)]
    pub rdp_username: Option<String>,
    #[serde(default)]
    pub rdp_domain: Option<String>,
    #[serde(default)]
    pub break_glass: bool,
}

#[derive(Debug, Serialize)]
pub struct ConsoleSessionResponse {
    pub session_id: String,
    pub vm_id: String,
    pub protocol: String,
    pub backend: String,
    pub embed_path: String,
    pub emergency_url: Option<String>,
    pub audit_id: String,
    pub expires_at: String,
    pub spectator_token: Option<String>,
}

impl ConsoleSessionStore {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    async fn insert(&self, session: LiveConsoleSession) -> Uuid {
        let id = Uuid::new_v4();
        let mut map = self.inner.write().await;
        map.retain(|_, v| v.expires > Instant::now());
        map.insert(id, session);
        id
    }

    async fn get(&self, id: Uuid) -> Option<LiveConsoleSession> {
        let map = self.inner.read().await;
        let entry = map.get(&id)?;
        if entry.expires < Instant::now() {
            return None;
        }
        Some(entry.clone())
    }
}

pub fn api_routes() -> Router<AppState> {
    Router::new()
        .route("/api/v1/vms/{id}/consolehub/plan", get(consolehub_plan))
        .route("/api/v1/vms/{id}/consolehub/sessions", get(list_sessions).post(create_session))
        .route("/api/v1/consolehub/sessions/{session_id}/end", post(end_session))
        .route("/api/v1/vms/{id}/consolehub/access-requests", post(create_access_request))
        .route("/api/v1/consolehub/access-requests/{request_id}/approve", post(approve_access_request))
        .route("/api/v1/vms/{id}/consolehub/break-glass", post(break_glass_session))
        .route("/api/v1/vms/{id}/consolehub/explain", post(consolehub_explain))
}

pub fn proxy_routes() -> Router<AppState> {
    Router::new()
        .route(
            "/consolehub/guacamole/{session_id}/websocket-tunnel",
            any(guac_ws_proxy),
        )
        .route("/consolehub/guacamole/{session_id}", any(guac_http_proxy_root))
        .route("/consolehub/guacamole/{session_id}/", any(guac_http_proxy_root))
        .route("/consolehub/guacamole/{session_id}/{*path}", any(guac_http_proxy))
}

async fn vm_row(state: &AppState, id: Uuid) -> Result<(String, Uuid), ApiError> {
    let row: (String, Option<Uuid>) =
        sqlx::query_as("SELECT name, host_id FROM vms WHERE id = $1")
            .bind(id)
            .fetch_one(&state.pool)
            .await?;
    let host_id = row.1.ok_or_else(|| ApiError::bad_request("vm has no host"))?;
    Ok((row.0, host_id))
}

async fn vm_meta(
    state: &AppState,
    id: Uuid,
) -> Result<(String, Option<Uuid>, String, Option<String>), ApiError> {
    let row: (String, Option<Uuid>, String, Option<String>) = sqlx::query_as(
        "SELECT name, host_id, COALESCE(inventory_source, 'libvirt'), k8s_namespace FROM vms WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await?;
    Ok(row)
}

fn kubevirt_plan(vm_id: Uuid, vm_name: &str, namespace: &str, ws_token: &str) -> ConsoleHubPlan {
    let enc_ns = urlencoding::encode(namespace);
    let enc_name = urlencoding::encode(vm_name);
    ConsoleHubPlan {
        vm_id: vm_id.to_string(),
        vm_name: vm_name.to_string(),
        recommended: "novnc".into(),
        native: NativeConsoleInfo {
            console_type: "vnc".into(),
            ws_path: format!(
                "/ws/v1/k8s-kubevirt/{enc_ns}/{enc_name}/vnc?token={ws_token}"
            ),
            serial_ws_path: format!(
                "/ws/v1/k8s-kubevirt/{enc_ns}/{enc_name}/console?token={ws_token}"
            ),
            available: true,
        },
        guacamole: GuacamoleConsoleInfo {
            available: false,
            protocols: vec![],
        },
        guest_ip: None,
        ssh_user: None,
        os_hint: "kubevirt".into(),
        protocols: vec!["novnc".into()],
        webrtc_spice_available: false,
        guest_access: empty_guest_access(),
    }
}

fn check_federated_console_auth(
    state: &AppState,
    user: &AuthUser,
) -> Result<(), ApiError> {
    if !state.config.consolehub_require_oidc {
        return Ok(());
    }
    match user.auth_source.as_deref() {
        Some("oidc") | Some("saml") => Ok(()),
        _ => Err(ApiError::bad_request("ConsoleHub requires federated SSO login")
            .with_code("console_oidc_required")
            .with_remediation("Sign in via Platform → OIDC/SAML before opening a production console.")),
    }
}

async fn host_agent_grpc(pool: &sqlx::PgPool, host_id: Uuid) -> Result<String, ApiError> {
    let addr: String = sqlx::query_scalar("SELECT agent_grpc_addr FROM hosts WHERE id = $1")
        .bind(host_id)
        .fetch_one(pool)
        .await?;
    Ok(addr)
}

async fn host_agent_console(pool: &sqlx::PgPool, host_id: Uuid) -> Result<String, ApiError> {
    let addr: String = sqlx::query_scalar(
        "SELECT COALESCE(NULLIF(agent_console_addr, ''), agent_grpc_addr) FROM hosts WHERE id = $1",
    )
    .bind(host_id)
    .fetch_one(pool)
    .await?;
    Ok(addr)
}

async fn host_guacamole_config(
    pool: &sqlx::PgPool,
    host_id: Uuid,
    fallback: &crate::config::ControllerConfig,
) -> (String, String, bool) {
    let row: Option<(String, String)> = sqlx::query_as(
        "SELECT guacamole_base_url, guacamole_json_secret_hex FROM hosts WHERE id = $1",
    )
    .bind(host_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();

    let (base, secret) = row.unwrap_or_default();
    let base_url = if base.trim().is_empty() {
        fallback.guacamole_base_url.clone()
    } else {
        base
    };
    let secret_hex = if secret.trim().is_empty() {
        fallback.guacamole_json_secret_hex.clone()
    } else {
        secret
    };
    let enabled = fallback.guacamole_enabled && !secret_hex.trim().is_empty();
    (base_url, secret_hex, enabled)
}

fn empty_guest_access() -> GuestAccessHints {
    GuestAccessHints {
        auth_mode: "unknown".into(),
        serial_password_login: true,
        guest_ip_private: false,
        ssh_nat_host_port: None,
    }
}

fn is_private_guest_ip(ip: &str) -> bool {
    let Ok(addr) = ip.trim().parse::<std::net::Ipv4Addr>() else {
        return false;
    };
    let o = addr.octets();
    o[0] == 10
        || (o[0] == 172 && (16..=31).contains(&o[1]))
        || (o[0] == 192 && o[1] == 168)
        || (o[0] == 169 && o[1] == 254)
}

fn auth_mode_from_spec(vm: &VirtualMachine) -> Option<String> {
    let ci = vm.spec.cloud_init.as_ref()?;
    let has_pw = ci.password.as_ref().is_some_and(|p| !p.is_empty());
    let has_key = ci.ssh_pubkey.as_ref().is_some_and(|k| !k.is_empty());
    Some(match (has_key, has_pw) {
        (true, true) => "both".into(),
        (true, false) => "ssh_key".into(),
        (false, true) => "password".into(),
        _ => "unknown".into(),
    })
}

fn serial_password_login(auth_mode: &str) -> bool {
    matches!(auth_mode, "password" | "both" | "unknown")
}

async fn build_guest_access_hints(
    pool: &sqlx::PgPool,
    host_id: Uuid,
    agent: &machina_agent::pb::GetConsoleAccessPlanResponse,
    spec_vm: Option<&VirtualMachine>,
) -> GuestAccessHints {
    let mut auth_mode = if agent.guest_auth_mode.is_empty() {
        "unknown".into()
    } else {
        agent.guest_auth_mode.clone()
    };
    if auth_mode == "unknown" {
        if let Some(vm) = spec_vm {
            if let Some(from_spec) = auth_mode_from_spec(vm) {
                auth_mode = from_spec;
            }
        }
    }
    let guest_ip = agent.guest_ip.trim();
    let guest_ip_private = is_private_guest_ip(guest_ip);
    let mut ssh_nat_host_port = None;
    if !guest_ip.is_empty() {
        if let Ok(agent_addr) = host_agent_grpc(pool, host_id).await {
            if let Ok(rules) = agent_client::list_port_forwards(&agent_addr).await {
                ssh_nat_host_port = rules
                    .iter()
                    .find(|r| {
                        r.protocol.eq_ignore_ascii_case("tcp")
                            && r.vm_ip == guest_ip
                            && r.vm_port == 22
                    })
                    .map(|r| r.host_port);
            }
        }
    }
    GuestAccessHints {
        auth_mode: auth_mode.clone(),
        serial_password_login: serial_password_login(&auth_mode),
        guest_ip_private,
        ssh_nat_host_port,
    }
}

fn plan_from_agent(
    vm_id: Uuid,
    vm_name: &str,
    agent: &machina_agent::pb::GetConsoleAccessPlanResponse,
    ws_token: &str,
    guest_access: GuestAccessHints,
) -> ConsoleHubPlan {
    let recommended = if agent.recommended.is_empty() {
        "novnc".into()
    } else {
        agent.recommended.clone()
    };
    ConsoleHubPlan {
        vm_id: vm_id.to_string(),
        vm_name: vm_name.to_string(),
        recommended,
        native: NativeConsoleInfo {
            console_type: agent.console_type.clone(),
            ws_path: format!("/ws/v1/platform/vnc/{vm_id}?token={ws_token}"),
            serial_ws_path: format!("/ws/v1/platform/serial/{vm_id}?token={ws_token}"),
            available: agent.vnc_port > 0,
        },
        guacamole: GuacamoleConsoleInfo {
            available: agent.guacamole_available,
            protocols: agent.guacamole_protocols.clone(),
        },
        guest_ip: if agent.guest_ip.is_empty() {
            None
        } else {
            Some(agent.guest_ip.clone())
        },
        ssh_user: if agent.ssh_user.is_empty() {
            None
        } else {
            Some(agent.ssh_user.clone())
        },
        os_hint: if agent.os_hint.is_empty() {
            "unknown".into()
        } else {
            agent.os_hint.clone()
        },
        protocols: build_protocol_list(agent),
        webrtc_spice_available: agent.console_type == "spice",
        guest_access,
    }
}

fn build_protocol_list(agent: &machina_agent::pb::GetConsoleAccessPlanResponse) -> Vec<String> {
    let mut out = Vec::new();
    if agent.console_type == "spice" {
        out.push("spice".into());
        out.push("webrtc_spice".into());
    }
    out.push("novnc".into());
    if agent.guacamole_available {
        for p in &agent.guacamole_protocols {
            out.push(format!("guacamole_{p}"));
        }
    }
    out.push("serial".into());
    out
}

pub async fn consolehub_plan(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ConsoleHubPlan>, ApiError> {
    let (vm_name, _host_id, source, k8s_namespace) = vm_meta(&state, id).await?;
    if source == "kubevirt" {
        let ns = k8s_namespace.unwrap_or_else(|| "default".into());
        let ws_token = state.ws_tokens.issue(id).await;
        return Ok(Json(kubevirt_plan(id, &vm_name, &ns, &ws_token)));
    }
    let (vm_name, host_id) = vm_row(&state, id).await?;
    let agent_addr = host_agent_grpc(&state.pool, host_id).await?;
    let mut client = agent_client::connect(&agent_addr).await.map_err(|e| ApiError::internal(e.to_string()))?;
    let agent_plan = agent_client::get_console_access_plan(&mut client, &vm_name)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))?;
    let spec_vm: Option<VirtualMachine> = sqlx::query_scalar("SELECT spec_json FROM vms WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .ok()
        .flatten()
        .and_then(|v| serde_json::from_value(v).ok());
    let guest_access =
        build_guest_access_hints(&state.pool, host_id, &agent_plan, spec_vm.as_ref()).await;
    let ws_token = state.ws_tokens.issue(id).await;
    let mut plan = plan_from_agent(id, &vm_name, &agent_plan, &ws_token, guest_access);
    let (_, _, guac_enabled) = host_guacamole_config(&state.pool, host_id, &state.config).await;
    if !guac_enabled {
        plan.guacamole.available = false;
        plan.guacamole.protocols.clear();
        plan.protocols.retain(|p| !p.starts_with("guacamole_"));
        if plan.recommended.starts_with("guacamole_") {
            plan.recommended = if plan.native.available {
                "novnc".into()
            } else {
                "serial".into()
            };
        }
    }
    Ok(Json(plan))
}

async fn check_console_rbac(
    _state: &AppState,
    user: &AuthUser,
    protocol: &str,
) -> Result<(), ApiError> {
    if user.role == "viewer" && (protocol.contains("rdp") || protocol == "serial") {
        return Err(ApiError::bad_request("viewer role cannot open RDP or serial console")
            .with_code("console_rbac")
            .with_remediation("Request operator access or use SSH/noVNC."));
    }
    Ok(())
}

fn check_device_posture(posture_header: Option<&str>) -> Result<(), ApiError> {
    let required = std::env::var("CONSOLEHUB_REQUIRE_POSTURE")
        .map(|v| matches!(v.to_lowercase().as_str(), "1" | "true" | "yes"))
        .unwrap_or(false);
    if !required {
        return Ok(());
    }
    match posture_header.map(str::trim).filter(|s| !s.is_empty()) {
        Some("trusted") | Some("compliant") => Ok(()),
        _ => Err(ApiError::bad_request("device posture check failed")
            .with_code("console_posture_required")
            .with_remediation("Connect from a managed device with valid Zeus posture attestation.")),
    }
}

async fn check_jit_approval(
    state: &AppState,
    vm_id: Uuid,
    user: &AuthUser,
    protocol: &str,
) -> Result<(), ApiError> {
    if !state.config.consolehub_require_approval {
        return Ok(());
    }
    let approved: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM console_access_requests WHERE vm_id = $1 AND requester = $2 AND protocol = $3 AND status = 'approved' AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY approved_at DESC LIMIT 1",
    )
    .bind(vm_id)
    .bind(&user.username)
    .bind(protocol)
    .fetch_optional(&state.pool)
    .await?;
    if approved.is_some() {
        return Ok(());
    }
    Err(ApiError::bad_request("console access requires approval")
        .with_code("console_approval_required")
        .with_remediation("Platform → Zeus → Approvals — request JIT console access for this VM."))
}

pub async fn create_session(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateSessionBody>,
) -> Result<Json<ConsoleSessionResponse>, ApiError> {
    check_federated_console_auth(&state, &user)?;
    let (vm_name, _host_id, source, k8s_namespace) = vm_meta(&state, id).await?;
    if source == "kubevirt" {
        let protocol = body
            .protocol
            .clone()
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "novnc".into());
        if protocol.starts_with("guacamole_") {
            return Err(ApiError::bad_request("Guacamole protocols are not available for KubeVirt guests"));
        }
        check_console_rbac(&state, &user, &protocol).await?;
        if !body.break_glass {
            check_jit_approval(&state, id, &user, &protocol).await?;
        } else {
            crate::auth::require_operator(&user)?;
        }
        check_device_posture(headers.get("x-zeus-device-posture").and_then(|v| v.to_str().ok()))?;
        let ws_token = state.ws_tokens.issue(id).await;
        let audit_id = Uuid::new_v4();
        let ttl = Duration::from_secs(state.config.consolehub_session_ttl_secs);
        let expires_at = chrono::Utc::now() + chrono::Duration::seconds(ttl.as_secs() as i64);
        let session_id = state
            .console_sessions
            .insert(LiveConsoleSession {
                vm_id: id,
                actor: user.username.clone(),
                protocol: protocol.clone(),
                backend: "native".into(),
                guac_token: None,
                agent_proxy_base: String::new(),
                emergency_url: None,
                expires: Instant::now() + ttl,
                audit_id,
            })
            .await;
        let ns = k8s_namespace.unwrap_or_else(|| "default".into());
        let embed_path = format!(
            "/platform/vms/{id}/consolehub?session={session_id}&native=1&kubevirt=1&namespace={}&token={ws_token}",
            urlencoding::encode(&ns)
        );
        return Ok(Json(ConsoleSessionResponse {
            session_id: session_id.to_string(),
            vm_id: id.to_string(),
            protocol,
            backend: "native".into(),
            embed_path,
            emergency_url: None,
            audit_id: audit_id.to_string(),
            expires_at: expires_at.to_rfc3339(),
            spectator_token: None,
        }));
    }
    let (vm_name, host_id) = vm_row(&state, id).await?;
    let agent_addr = host_agent_grpc(&state.pool, host_id).await?;
    let mut client = agent_client::connect(&agent_addr).await.map_err(|e| ApiError::internal(e.to_string()))?;
    let agent_plan = agent_client::get_console_access_plan(&mut client, &vm_name)
        .await
        .map_err(|e| ApiError::internal(e.to_string()))?;

    let protocol = body
        .protocol
        .clone()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| agent_plan.recommended.clone());

    check_console_rbac(&state, &user, &protocol).await?;
    if !body.break_glass {
        check_jit_approval(&state, id, &user, &protocol).await?;
    } else {
        crate::auth::require_operator(&user)?;
    }
    check_device_posture(headers.get("x-zeus-device-posture").and_then(|v| v.to_str().ok()))?;

    if body.break_glass {
        sqlx::query(
            "INSERT INTO audit_logs (id, actor, action, resource_type, resource_id, detail)
             VALUES ($1,$2,$3,$4,$5,$6)",
        )
        .bind(Uuid::new_v4())
        .bind(&user.username)
        .bind("consolehub.break_glass")
        .bind("vm")
        .bind(id)
        .bind(SqlxJson(serde_json::json!({ "protocol": protocol })))
        .execute(&state.pool)
        .await?;
    }

    let ws_token = state.ws_tokens.issue(id).await;
    let audit_id = Uuid::new_v4();
    let ttl = Duration::from_secs(state.config.consolehub_session_ttl_secs);
    let expires_at = chrono::Utc::now() + chrono::Duration::seconds(ttl.as_secs() as i64);

    let agent_console = host_agent_console(&state.pool, host_id).await?;
    let agent_proxy = format!("http://{}", agent_client::normalize_agent_addr(&agent_console));
    let prefix = state.config.consolehub_proxy_prefix.trim_end_matches('/');

    let (backend, guac_token, emergency_url): (String, Option<String>, Option<String>) = if protocol.starts_with("guacamole_") {
        let (base_url, secret_hex, enabled) =
            host_guacamole_config(&state.pool, host_id, &state.config).await;
        if !enabled {
            return Err(ApiError::bad_request("Guacamole not configured on this host")
                .with_remediation("Run: sudo bash scripts/install-guacamole.sh on the hypervisor."));
        }
        let guest_ip = agent_plan.guest_ip.clone();
        let target = guac_target_for_protocol(
            &protocol,
            &vm_name,
            &agent_plan,
            guest_ip,
            body.rdp_username.as_deref(),
            body.rdp_domain.as_deref(),
        )?;
        let params = GuacamoleBridgeParams {
            secret_hex: &secret_hex,
            base_url: &base_url,
            public_vnc_host: None,
            fetch_token: state.config.guacamole_fetch_token,
            username: "machina",
        };
        let bridge = bridge_from_plan(vm_name.clone(), target, &params)
            .await
            .map_err(|e| ApiError::internal(e.to_string()))?;
        let emergency = bridge.token.as_ref().map(|t| {
            format!(
                "{}/#/?token={}",
                base_url.trim_end_matches('/'),
                urlencoding::encode(t)
            )
        });
        (String::from("guacamole"), bridge.token, emergency)
    } else {
        (String::from("native"), None, None)
    };

    let session_id = state
        .console_sessions
        .insert(LiveConsoleSession {
            vm_id: id,
            actor: user.username.clone(),
            protocol: protocol.clone(),
            backend: backend.clone(),
            guac_token: guac_token.clone(),
            agent_proxy_base: agent_proxy.clone(),
            emergency_url: emergency_url.clone(),
            expires: Instant::now() + ttl,
            audit_id,
        })
        .await;

    let recording = state.config.consolehub_recording_enabled || body.break_glass;
    sqlx::query(
        "INSERT INTO console_sessions (id, vm_id, host_id, actor, protocol, backend, guac_token, agent_proxy_base, emergency_url, expires_at, audit_id, recording_enabled)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
    )
    .bind(session_id)
    .bind(id)
    .bind(host_id)
    .bind(&user.username)
    .bind(&protocol)
    .bind(&backend)
    .bind(guac_token.as_deref())
    .bind(&agent_proxy)
    .bind(emergency_url.as_deref())
    .bind(expires_at)
    .bind(audit_id)
    .bind(recording)
    .execute(&state.pool)
    .await?;

    sqlx::query(
        "INSERT INTO audit_logs (id, actor, action, resource_type, resource_id, detail)
         VALUES ($1,$2,$3,$4,$5,$6)",
    )
    .bind(audit_id)
    .bind(&user.username)
    .bind("consolehub.session.start")
    .bind("vm")
    .bind(id)
    .bind(SqlxJson(serde_json::json!({ "protocol": protocol, "backend": backend, "session_id": session_id.to_string() })))
    .execute(&state.pool)
    .await?;

    let spectator_token = Uuid::new_v4().to_string();
    if recording {
        let _ = sqlx::query("UPDATE console_sessions SET spectator_token = $2 WHERE id = $1")
            .bind(session_id)
            .bind(&spectator_token)
            .execute(&state.pool)
            .await;
    }

    let embed_path = if backend == "guacamole" {
        let token_q = guac_token
            .as_deref()
            .map(|t| format!("?token={}", urlencoding::encode(t)))
            .unwrap_or_default();
        format!("{prefix}/{session_id}/index.html{token_q}")
    } else {
        format!("/platform/vms/{id}/consolehub?session={session_id}&native=1&token={ws_token}")
    };

    Ok(Json(ConsoleSessionResponse {
        session_id: session_id.to_string(),
        vm_id: id.to_string(),
        protocol,
        backend,
        embed_path,
        emergency_url,
        audit_id: audit_id.to_string(),
        expires_at: expires_at.to_rfc3339(),
        spectator_token: if recording { Some(spectator_token) } else { None },
    }))
}

pub async fn list_sessions(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<serde_json::Value>>, ApiError> {
    let rows: Vec<(Uuid, String, String, String, chrono::DateTime<chrono::Utc>, Option<chrono::DateTime<chrono::Utc>>)> =
        sqlx::query_as(
            "SELECT id, actor, protocol, backend, started_at, ended_at FROM console_sessions WHERE vm_id = $1 ORDER BY started_at DESC LIMIT 50",
        )
        .bind(id)
        .fetch_all(&state.pool)
        .await?;
    Ok(Json(
        rows.into_iter()
            .map(|(sid, actor, protocol, backend, started, ended)| {
                serde_json::json!({
                    "session_id": sid.to_string(),
                    "actor": actor,
                    "protocol": protocol,
                    "backend": backend,
                    "started_at": started.to_rfc3339(),
                    "ended_at": ended.map(|t| t.to_rfc3339()),
                })
            })
            .collect(),
    ))
}

#[derive(Debug, Deserialize)]
pub struct BreakGlassBody {
    pub protocol: String,
    #[serde(default)]
    pub reason: String,
}

/// Break-glass console access with mandatory audit + recording (Phase 5).
pub async fn break_glass_session(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(body): Json<BreakGlassBody>,
) -> Result<Json<ConsoleSessionResponse>, ApiError> {
    create_session(
        State(state),
        Extension(user),
        headers,
        Path(id),
        Json(CreateSessionBody {
            protocol: Some(body.protocol),
            rdp_username: None,
            rdp_domain: None,
            break_glass: true,
        }),
    )
    .await
}

fn guac_target_for_protocol(
    protocol: &str,
    vm_name: &str,
    plan: &machina_agent::pb::GetConsoleAccessPlanResponse,
    guest_ip: String,
    rdp_user: Option<&str>,
    rdp_domain: Option<&str>,
) -> Result<GuacBridgeTarget, ApiError> {
    match protocol {
        "guacamole_vnc" => {
            if plan.vnc_port <= 0 {
                return Err(ApiError::bad_request("VNC not available for this VM"));
            }
            Ok(GuacBridgeTarget::Vnc {
                host: plan.vnc_host.clone(),
                port: plan.vnc_port as u16,
            })
        }
        "guacamole_rdp" => {
            if guest_ip.is_empty() {
                return Err(ApiError::bad_request("guest IP required for RDP"));
            }
            Ok(GuacBridgeTarget::Rdp {
                host: guest_ip,
                port: if plan.rdp_port > 0 {
                    plan.rdp_port as u16
                } else {
                    3389
                },
                username: rdp_user.unwrap_or("Administrator").to_string(),
                domain: rdp_domain.unwrap_or("").to_string(),
            })
        }
        "guacamole_ssh" => {
            if guest_ip.is_empty() {
                return Err(ApiError::bad_request("guest IP required for SSH"));
            }
            Ok(GuacBridgeTarget::Ssh {
                host: guest_ip,
                port: 22,
                username: if plan.ssh_user.is_empty() {
                    "ubuntu".into()
                } else {
                    plan.ssh_user.clone()
                },
            })
        }
        other => Err(ApiError::bad_request(format!("unsupported Guacamole protocol: {other}"))),
    }
}

pub async fn end_session(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(session_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    sqlx::query(
        "UPDATE console_sessions SET ended_at = NOW() WHERE id = $1 AND actor = $2",
    )
    .bind(session_id)
    .bind(&user.username)
    .execute(&state.pool)
    .await?;
    Ok(Json(serde_json::json!({ "ended": true, "session_id": session_id.to_string() })))
}

#[derive(Debug, Deserialize)]
pub struct AccessRequestBody {
    pub protocol: String,
    #[serde(default)]
    pub reason: String,
}

pub async fn create_access_request(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(body): Json<AccessRequestBody>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let request_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO console_access_requests (id, vm_id, requester, protocol, reason, status, expires_at)
         VALUES ($1,$2,$3,$4,$5,'pending', NOW() + INTERVAL '24 hours')",
    )
    .bind(request_id)
    .bind(id)
    .bind(&user.username)
    .bind(&body.protocol)
    .bind(body.reason.trim())
    .execute(&state.pool)
    .await?;
    Ok(Json(serde_json::json!({
        "request_id": request_id.to_string(),
        "status": "pending",
        "message": "JIT console access request submitted — await approval in Zeus → Approvals."
    })))
}

pub async fn approve_access_request(
    State(state): State<AppState>,
    Extension(user): Extension<AuthUser>,
    Path(request_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    crate::auth::require_operator(&user)?;
    let updated = sqlx::query(
        "UPDATE console_access_requests SET status = 'approved', approved_by = $2, approved_at = NOW(), expires_at = NOW() + INTERVAL '4 hours'
         WHERE id = $1 AND status = 'pending'",
    )
    .bind(request_id)
    .bind(&user.username)
    .execute(&state.pool)
    .await?;
    if updated.rows_affected() == 0 {
        return Err(ApiError::bad_request("request not found or already processed"));
    }
    Ok(Json(serde_json::json!({ "approved": true, "request_id": request_id.to_string() })))
}

async fn guac_http_proxy_root(
    State(state): State<AppState>,
    Path(session_id): Path<Uuid>,
    req: axum::http::Request<Body>,
) -> Result<Response, StatusCode> {
    guac_http_proxy_impl(state, session_id, String::new(), req).await
}

async fn guac_http_proxy(
    State(state): State<AppState>,
    Path((session_id, path)): Path<(Uuid, String)>,
    req: axum::http::Request<Body>,
) -> Result<Response, StatusCode> {
    guac_http_proxy_impl(state, session_id, path, req).await
}

async fn guac_http_proxy_impl(
    state: AppState,
    session_id: Uuid,
    path: String,
    req: axum::http::Request<Body>,
) -> Result<Response, StatusCode> {
    let session = state
        .console_sessions
        .get(session_id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;

    let (parts, body) = req.into_parts();
    let path = path.trim_start_matches('/');
    let query = parts
        .uri
        .query()
        .map(|q| format!("?{q}"))
        .unwrap_or_default();
    let url = if path.is_empty() {
        format!("{}/guacamole-proxy/{query}", session.agent_proxy_base.trim_end_matches('/'))
    } else {
        format!(
            "{}/guacamole-proxy/{path}{query}",
            session.agent_proxy_base.trim_end_matches('/')
        )
    };

    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let method = parts.method.clone();
    let mut rb = client.request(method.clone(), &url);
    for (k, v) in parts.headers.iter() {
        let name = k.as_str();
        if matches!(
            name,
            "host" | "connection" | "transfer-encoding" | "upgrade" | "content-length"
        ) {
            continue;
        }
        if let Ok(s) = v.to_str() {
            rb = rb.header(name, s);
        }
    }

    let body_bytes = axum::body::to_bytes(body, 32 * 1024 * 1024)
        .await
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    if method != Method::GET && method != Method::HEAD && !body_bytes.is_empty() {
        rb = rb.body(body_bytes.to_vec());
    }

    let resp = rb.send().await.map_err(|_| StatusCode::BAD_GATEWAY)?;
    let status = StatusCode::from_u16(resp.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    let mut out = Response::builder().status(status);
    let headers = out.headers_mut().ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;
    for (k, v) in resp.headers().iter() {
        let name = k.as_str();
        if matches!(name, "transfer-encoding" | "connection" | "content-encoding") {
            continue;
        }
        if let Ok(val) = HeaderValue::from_bytes(v.as_bytes()) {
            headers.insert(k, val);
        }
    }
    let bytes = resp.bytes().await.map_err(|_| StatusCode::BAD_GATEWAY)?;
    Ok(out.body(Body::from(bytes)).unwrap())
}

async fn guac_ws_proxy(
    State(state): State<AppState>,
    Path(session_id): Path<Uuid>,
    ws: WebSocketUpgrade,
    req: axum::http::Request<Body>,
) -> Result<impl IntoResponse, StatusCode> {
    let session = state
        .console_sessions
        .get(session_id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;
    let query = req.uri().query().unwrap_or("").to_string();
    let target = format!(
        "ws://{}/guacamole-proxy/websocket-tunnel{}",
        agent_client::normalize_agent_addr(&session.agent_proxy_base.strip_prefix("http://").unwrap_or(&session.agent_proxy_base)),
        if query.is_empty() { String::new() } else { format!("?{query}") }
    );
    Ok(ws.on_upgrade(move |socket| proxy_guac_ws(socket, target)))
}

async fn proxy_guac_ws(client: WebSocket, target: String) {
    use tokio_tungstenite::{connect_async, tungstenite::Message as TsMessage};

    let upstream = match connect_async(&target).await {
        Ok((stream, _)) => stream,
        Err(_) => {
            let (mut sink, _) = client.split();
            let _ = sink.close().await;
            return;
        }
    };

    let (mut client_sink, mut client_stream) = client.split();
    let (mut up_sink, mut up_stream) = upstream.split();

    let c2u = tokio::spawn(async move {
        while let Some(Ok(msg)) = client_stream.next().await {
            let out = match msg {
                Message::Binary(b) => TsMessage::Binary(b.to_vec().into()),
                Message::Text(t) => TsMessage::Text(t.to_string().into()),
                Message::Ping(p) => TsMessage::Ping(p.into()),
                Message::Pong(p) => TsMessage::Pong(p.into()),
                Message::Close(c) => TsMessage::Close(c.map(|f| {
                    tokio_tungstenite::tungstenite::protocol::CloseFrame {
                        code: f.code.into(),
                        reason: f.reason.to_string().into(),
                    }
                })),
            };
            if up_sink.send(out).await.is_err() {
                break;
            }
        }
    });

    let u2c = tokio::spawn(async move {
        while let Some(Ok(msg)) = up_stream.next().await {
            let out = match msg {
                TsMessage::Binary(b) => Message::Binary(b.into()),
                TsMessage::Text(t) => Message::Text(t.to_string().into()),
                TsMessage::Ping(p) => Message::Ping(p.into()),
                TsMessage::Pong(p) => Message::Pong(p.into()),
                TsMessage::Close(_) => Message::Close(None),
                _ => continue,
            };
            if client_sink.send(out).await.is_err() {
                break;
            }
        }
    });

    tokio::select! {
        _ = c2u => {},
        _ = u2c => {},
    }
}

/// Extend legacy console info endpoint shape (backward compatible).
#[derive(Debug, Deserialize)]
pub struct ConsoleExplainBody {
    #[serde(default)]
    pub intent: String,
    #[serde(default)]
    pub lens: String,
    #[serde(default)]
    pub guest_ip: Option<String>,
    #[serde(default)]
    pub vm_state: Option<String>,
    #[serde(default)]
    pub screen_snapshot: Option<String>,
}

pub async fn consolehub_explain(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<ConsoleExplainBody>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let (vm_name, _host_id) = vm_row(&state, id).await?;
    let intent = if body.intent.is_empty() { "explain_screen" } else { body.intent.as_str() };
    let mut lines = vec![format!("**{}** — ConsoleHub lens: {}", vm_name, body.lens)];
    if let Some(ip) = &body.guest_ip {
        if !ip.is_empty() {
            lines.push(format!("Guest IP visible: `{ip}` — try SSH from the host when sshd is up."));
        }
    }
    if let Some(st) = &body.vm_state {
        lines.push(format!("VM state: {st}"));
    }
    match intent {
        "diagnose_boot" => {
            lines.push("If the display is black, open **Serial** for boot output.".into());
            lines.push("Common causes: missing virtio drivers, wrong root device, cloud-init failure.".into());
        }
        "fix_network" => {
            lines.push("Check guest NIC, cloud-init network config, and host/CNI routes.".into());
            lines.push("Use **Network** lens or PacketWolf trace when fabric is enabled.".into());
        }
        _ => {
            lines.push("Analyze the visible console for login prompts, installers, or error screens.".into());
            if body.guest_ip.as_deref().unwrap_or("").is_empty() {
                lines.push("No guest IP reported — network may still be initializing.".into());
            } else {
                lines.push("Guest appears to have network — console and SSH should be reachable.".into());
            }
        }
    }
    let object_ref = serde_json::json!({ "vm_id": id.to_string(), "intent": intent });
    if let Ok(text) = crate::engine::ai::explain_screen(&state.pool, "console_hub", &object_ref).await {
        lines.push(text);
    }
    Ok(Json(serde_json::json!({ "explanation": lines.join("\n\n") })))
}

pub fn console_info_from_plan(plan: &ConsoleHubPlan) -> serde_json::Value {
    serde_json::json!({
        "vm_id": plan.vm_id,
        "vm_name": plan.vm_name,
        "console_type": plan.native.console_type,
        "ws_path": plan.native.ws_path,
        "consolehub": plan,
    })
}
