use axum::body::Body;
use axum::extract::State;
use axum::http::{header, Request, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum::routing::{delete, get, post};
use axum::{Extension, Json, Router};
use rand::Rng;
use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tracing::{info, warn};
use virtspawn_core::{AuthConfig, LibvirtError, LibvirtManager};

use crate::error::AppError;

/// Authenticated HTTP actor (cookie session or API bearer token).
#[derive(Clone, Debug)]
pub struct RequestActor {
    pub username: String,
    /// API tokens must not perform sensitive host administration (e.g. OS user creation).
    pub from_api_token: bool,
}

/// Session store: token -> (username, created_at)
#[derive(Clone)]
pub struct SessionStore {
    sessions: Arc<Mutex<HashMap<String, SessionData>>>,
    ws_tokens: Arc<Mutex<HashMap<String, WsTokenData>>>,
}

struct SessionData {
    username: String,
    created_at: Instant,
    /// Opaque id for admin revoke (never the secret cookie token).
    public_id: String,
}

/// Row for `GET /admin/sessions` (root only).
#[derive(Serialize)]
pub struct SessionListEntry {
    pub session_id: String,
    pub username: String,
    pub age_secs: u64,
    pub expires_in_secs: u64,
    pub is_current: bool,
}

const SESSION_TTL_SECS: u64 = 86400; // 24 hours
const MAX_SESSIONS: usize = 1000;
const MAX_SESSIONS_PER_USER: usize = 10;

struct WsTokenData {
    username: String,
    created_at: Instant,
}

impl SessionStore {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            ws_tokens: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    fn create_session(&self, username: &str) -> String {
        let mut rng = rand::thread_rng();
        let token_bytes: [u8; 32] = rng.gen();
        let token = hex::encode(token_bytes);
        let public_id_bytes: [u8; 16] = rng.gen();
        let public_id = hex::encode(public_id_bytes);

        let mut sessions = self.sessions.lock().unwrap_or_else(|e| e.into_inner());

        // Purge expired sessions
        sessions.retain(|_, data| data.created_at.elapsed().as_secs() < SESSION_TTL_SECS);

        // Enforce MAX_SESSIONS: if over, remove the oldest session
        if sessions.len() >= MAX_SESSIONS {
            if let Some(oldest_token) = sessions
                .iter()
                .min_by_key(|(_, data)| data.created_at)
                .map(|(tok, _)| tok.clone())
            {
                sessions.remove(&oldest_token);
            }
        }

        // Enforce MAX_SESSIONS_PER_USER: if over for this user, remove the oldest
        let user_sessions: Vec<String> = sessions
            .iter()
            .filter(|(_, data)| data.username == username)
            .map(|(tok, _)| tok.clone())
            .collect();
        if user_sessions.len() >= MAX_SESSIONS_PER_USER {
            if let Some(oldest_token) = user_sessions
                .iter()
                .min_by_key(|tok| sessions.get(tok.as_str()).map(|d| d.created_at))
                .cloned()
            {
                sessions.remove(&oldest_token);
            }
        }

        sessions.insert(
            token.clone(),
            SessionData {
                username: username.to_string(),
                created_at: Instant::now(),
                public_id,
            },
        );
        token
    }

    fn validate_session(&self, token: &str) -> Option<String> {
        let mut sessions = self.sessions.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(data) = sessions.get(token) {
            if data.created_at.elapsed().as_secs() < SESSION_TTL_SECS {
                return Some(data.username.clone());
            }
            // Session expired — remove it
            sessions.remove(token);
        }
        None
    }

    /// Public id for the given session cookie token, if still valid.
    pub fn session_public_id(&self, token: &str) -> Option<String> {
        let sessions = self.sessions.lock().unwrap_or_else(|e| e.into_inner());
        sessions.get(token).and_then(|data| {
            if data.created_at.elapsed().as_secs() < SESSION_TTL_SECS {
                Some(data.public_id.clone())
            } else {
                None
            }
        })
    }

    /// All non-expired browser sessions (in-memory).
    pub fn list_browser_sessions(&self, current_public_id: Option<&str>) -> Vec<SessionListEntry> {
        let mut sessions = self.sessions.lock().unwrap_or_else(|e| e.into_inner());
        sessions.retain(|_, data| data.created_at.elapsed().as_secs() < SESSION_TTL_SECS);
        let mut out: Vec<SessionListEntry> = sessions
            .iter()
            .map(|(_, data)| {
                let age = data.created_at.elapsed().as_secs();
                SessionListEntry {
                    session_id: data.public_id.clone(),
                    username: data.username.clone(),
                    age_secs: age,
                    expires_in_secs: SESSION_TTL_SECS.saturating_sub(age),
                    is_current: current_public_id == Some(data.public_id.as_str()),
                }
            })
            .collect();
        out.sort_by(|a, b| a.age_secs.cmp(&b.age_secs));
        out
    }

    /// Revoke a session by its public id. Returns false if not found.
    pub fn revoke_session_by_public_id(&self, public_id: &str) -> bool {
        let mut sessions = self.sessions.lock().unwrap_or_else(|e| e.into_inner());
        let token = sessions
            .iter()
            .find(|(_, d)| d.public_id == public_id)
            .map(|(t, _)| t.clone());
        if let Some(t) = token {
            sessions.remove(&t);
            return true;
        }
        false
    }

    pub fn remove_session(&self, token: &str) {
        let mut sessions = self.sessions.lock().unwrap_or_else(|e| e.into_inner());
        sessions.remove(token);
    }

    /// Create a single-use WebSocket token valid for 60 seconds.
    pub fn create_ws_token(&self, username: &str) -> String {
        let mut rng = rand::thread_rng();
        let token_bytes: [u8; 32] = rng.gen();
        let token = hex::encode(token_bytes);

        let mut ws_tokens = self.ws_tokens.lock().unwrap_or_else(|e| e.into_inner());
        // Purge expired ws tokens while we have the lock
        ws_tokens.retain(|_, data| data.created_at.elapsed().as_secs() < 60);
        ws_tokens.insert(
            token.clone(),
            WsTokenData {
                username: username.to_string(),
                created_at: Instant::now(),
            },
        );
        token
    }

    /// Validate and consume a single-use WebSocket token.
    /// Returns the username if the token exists and is less than 60 seconds old.
    pub fn validate_ws_token(&self, token: &str) -> Option<String> {
        let mut ws_tokens = self.ws_tokens.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(data) = ws_tokens.remove(token) {
            if data.created_at.elapsed().as_secs() < 60 {
                return Some(data.username);
            }
        }
        None
    }
}

/// Extract session token from cookie header.
fn extract_token(req: &Request<Body>) -> Option<String> {
    let cookie_header = req.headers().get(header::COOKIE)?.to_str().ok()?;
    for part in cookie_header.split(';') {
        let part = part.trim();
        if let Some(value) = part.strip_prefix("virtspawn_session=") {
            let token = value.trim();
            if !token.is_empty() {
                return Some(token.to_string());
            }
        }
    }
    None
}

/// Auth middleware — checks for valid session cookie.
/// Skips health check. Applied via route_layer on API/WS routes.
pub async fn auth_middleware(
    State(store): State<SessionStore>,
    mut req: Request<Body>,
    next: Next,
) -> Response {
    let path = req.uri().path();

    // Public endpoints (paths after nest stripping of /api/v1 or /ws/v1)
    if path == "/health" || path.starts_with("/auth/") {
        return next.run(req).await;
    }

    // Check session cookie
    if let Some(token) = extract_token(&req) {
        if let Some(username) = store.validate_session(&token) {
            req.extensions_mut().insert(RequestActor {
                username,
                from_api_token: false,
            });
            return next.run(req).await;
        }
    }

    // Check Authorization header for API tokens (Bearer vs_xxx)
    if let Some(auth_header) = req.headers().get("authorization").and_then(|v| v.to_str().ok()) {
        if let Some(token) = auth_header.strip_prefix("Bearer ") {
            if let Some(api) = virtspawn_core::libvirt::automation::validate_api_token(token) {
                req.extensions_mut().insert(RequestActor {
                    username: api.username,
                    from_api_token: true,
                });
                return next.run(req).await;
            }
        }
    }

    (
        StatusCode::UNAUTHORIZED,
        Json(serde_json::json!({ "error": "Authentication required" })),
    )
        .into_response()
}

// ── WebSocket token handler ────────────────────────────────────────

/// Create a single-use WebSocket token. Must be called from an authenticated context.
pub async fn ws_token_handler(
    Extension(sessions): Extension<SessionStore>,
    headers: axum::http::HeaderMap,
) -> impl IntoResponse {
    // Extract username from session cookie
    let username = headers
        .get(header::COOKIE)
        .and_then(|v| v.to_str().ok())
        .and_then(|cookie_header| {
            for part in cookie_header.split(';') {
                let part = part.trim();
                if let Some(value) = part.strip_prefix("virtspawn_session=") {
                    let token = value.trim();
                    if !token.is_empty() {
                        return sessions.validate_session(token);
                    }
                }
            }
            None
        })
        .or_else(|| {
            // Fall back to Authorization header (Bearer API token)
            headers
                .get("authorization")
                .and_then(|v| v.to_str().ok())
                .and_then(|auth| auth.strip_prefix("Bearer "))
                .and_then(|token| {
                    virtspawn_core::libvirt::automation::validate_api_token(token)
                        .map(|api_token| api_token.username)
                })
        });

    match username {
        Some(user) => {
            let token = sessions.create_ws_token(&user);
            (StatusCode::OK, Json(serde_json::json!({ "token": token }))).into_response()
        }
        None => {
            (StatusCode::UNAUTHORIZED, Json(serde_json::json!({ "error": "Authentication required" }))).into_response()
        }
    }
}

/// WebSocket auth middleware — checks for `?token=` query parameter.
pub async fn ws_auth_middleware(
    State(store): State<SessionStore>,
    req: Request<Body>,
    next: Next,
) -> Response {
    // Extract token from query string
    let token = req
        .uri()
        .query()
        .and_then(|q| {
            q.split('&').find_map(|pair| {
                pair.strip_prefix("token=").map(|v| v.to_string())
            })
        });

    if let Some(ref tok) = token {
        if store.validate_ws_token(tok).is_some() {
            return next.run(req).await;
        }
    }

    (
        StatusCode::UNAUTHORIZED,
        Json(serde_json::json!({ "error": "Valid WebSocket token required" })),
    )
        .into_response()
}

// ── Auth handlers (use Extension<SessionStore>) ────────────────────

#[derive(Deserialize)]
struct LoginRequest {
    username: String,
    password: String,
}

#[derive(Clone)]
pub struct PamAuth(pub std::sync::Arc<AuthConfig>);

async fn login_handler(
    Extension(store): Extension<SessionStore>,
    Extension(auth): Extension<PamAuth>,
    Json(req): Json<LoginRequest>,
) -> Response {
    if req.username.is_empty() || req.password.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": "Username and password required" }))).into_response();
    }

    if !req.username.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == '.') {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": "Invalid username characters" }))).into_response();
    }

    match pam_authenticate(&req.username, &req.password, &auth.0.pam_service) {
        Ok(()) => {
            info!("PAM login successful for user '{}'", req.username);
            let token = store.create_session(&req.username);
            let cookie = format!("virtspawn_session={token}; Path=/; HttpOnly; SameSite=Strict");
            (StatusCode::OK, [(header::SET_COOKIE, cookie)], Json(serde_json::json!({ "status": "ok", "username": req.username }))).into_response()
        }
        Err(e) => {
            warn!("PAM login failed for user '{}': {}", req.username, e);
            (StatusCode::UNAUTHORIZED, Json(serde_json::json!({ "error": "Invalid username or password" }))).into_response()
        }
    }
}

async fn logout_handler(
    Extension(store): Extension<SessionStore>,
    req: Request<Body>,
) -> Response {
    if let Some(token) = extract_token(&req) {
        store.remove_session(&token);
    }
    let cookie = "virtspawn_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0";
    (StatusCode::OK, [(header::SET_COOKIE, cookie)], Json(serde_json::json!({ "status": "logged_out" }))).into_response()
}

async fn session_handler(
    Extension(store): Extension<SessionStore>,
    req: Request<Body>,
) -> Response {
    if let Some(token) = extract_token(&req) {
        if let Some(username) = store.validate_session(&token) {
            let session_id = store.session_public_id(&token);
            return (
                StatusCode::OK,
                Json(serde_json::json!({
                    "authenticated": true,
                    "username": username,
                    "session_id": session_id,
                })),
            )
                .into_response();
        }
    }
    (StatusCode::UNAUTHORIZED, Json(serde_json::json!({ "authenticated": false }))).into_response()
}

fn require_root_session(actor: &RequestActor) -> Result<(), LibvirtError> {
    if actor.from_api_token {
        return Err(LibvirtError::Forbidden(
            "Session administration requires a browser login as root".into(),
        ));
    }
    if actor.username != "root" {
        return Err(LibvirtError::Forbidden(
            "Only the root user may list or revoke web sessions".into(),
        ));
    }
    Ok(())
}

async fn admin_list_sessions(
    Extension(store): Extension<SessionStore>,
    Extension(actor): Extension<RequestActor>,
    req: Request<Body>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_root_session(&actor)?;
    let current_public_id = extract_token(&req).and_then(|t| store.session_public_id(&t));
    let list = store.list_browser_sessions(current_public_id.as_deref());
    let total_sessions = list.len();
    let by_user: std::collections::HashMap<String, usize> = list.iter().fold(
        std::collections::HashMap::new(),
        |mut acc, s| {
            *acc.entry(s.username.clone()).or_insert(0) += 1;
            acc
        },
    );
    Ok(Json(serde_json::json!({
        "sessions": list,
        "total_sessions": total_sessions,
        "users_logged_in": by_user.len(),
        "sessions_per_username": by_user,
    })))
}

async fn admin_revoke_session(
    Extension(store): Extension<SessionStore>,
    Extension(actor): Extension<RequestActor>,
    axum::extract::Path(session_id): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_root_session(&actor)?;
    if session_id.chars().count() != 32 || !session_id.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(LibvirtError::Invalid("Invalid session_id".into()).into());
    }
    if store.revoke_session_by_public_id(&session_id) {
        info!("Session {} revoked by root", session_id);
        Ok(Json(serde_json::json!({ "status": "revoked", "session_id": session_id })))
    } else {
        Err(LibvirtError::NotFound("Session not found or already expired".into()).into())
    }
}

fn pam_authenticate(username: &str, password: &str, pam_service: &str) -> Result<(), String> {
    let mut client = pam::Client::with_password(pam_service)
        .map_err(|e| format!("PAM init failed ({pam_service}): {e}"))?;
    client.conversation_mut().set_credentials(username, password);
    client.authenticate().map_err(|e| format!("PAM auth failed: {e}"))?;
    // Skip open_session() — pam_loginuid fails under systemd with NoNewPrivileges.
    // We only need credential verification, not a full login session.
    Ok(())
}

/// Auth routes — these use Extension<SessionStore> so they can be merged
/// into Router<LibvirtManager> without state conflicts.
pub fn auth_routes(session_store: SessionStore, auth_cfg: AuthConfig) -> Router<LibvirtManager> {
    Router::new()
        .route("/auth/login", post(login_handler))
        .route("/auth/logout", post(logout_handler))
        .route("/auth/session", get(session_handler))
        .route("/ws-token", post(ws_token_handler))
        .route("/admin/sessions", get(admin_list_sessions))
        .route("/admin/sessions/{session_id}", delete(admin_revoke_session))
        .layer(Extension(session_store))
        .layer(Extension(PamAuth(std::sync::Arc::new(auth_cfg))))
}
