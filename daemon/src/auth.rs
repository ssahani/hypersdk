use axum::body::Body;
use axum::extract::State;
use axum::http::{header, Request, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Extension, Json, Router};
use rand::Rng;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tracing::{info, warn};
use virtspawn_core::LibvirtManager;

/// Session store: token -> (username, created_at)
#[derive(Clone)]
pub struct SessionStore {
    sessions: Arc<Mutex<HashMap<String, SessionData>>>,
}

struct SessionData {
    username: String,
}

impl SessionStore {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    fn create_session(&self, username: &str) -> String {
        let mut rng = rand::thread_rng();
        let token_bytes: [u8; 32] = rng.gen();
        let token = hex::encode(token_bytes);

        let mut sessions = self.sessions.lock().unwrap_or_else(|e| e.into_inner());
        sessions.insert(token.clone(), SessionData { username: username.to_string() });
        token
    }

    fn validate_session(&self, token: &str) -> Option<String> {
        let sessions = self.sessions.lock().unwrap_or_else(|e| e.into_inner());
        sessions.get(token).map(|s| s.username.clone())
    }

    fn remove_session(&self, token: &str) {
        let mut sessions = self.sessions.lock().unwrap_or_else(|e| e.into_inner());
        sessions.remove(token);
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
    req: Request<Body>,
    next: Next,
) -> Response {
    let path = req.uri().path();

    // Public endpoints (paths after nest stripping of /api/v1 or /ws/v1)
    if path == "/health" || path.starts_with("/auth/") {
        return next.run(req).await;
    }

    // Check session cookie
    if let Some(token) = extract_token(&req) {
        if store.validate_session(&token).is_some() {
            return next.run(req).await;
        }
    }

    // Also check query parameter ?token= (needed for WebSocket/iframe connections
    // where cookies can't be passed, e.g., noVNC iframe)
    if let Some(query) = req.uri().query() {
        for param in query.split('&') {
            if let Some(token) = param.strip_prefix("token=") {
                if !token.is_empty() && store.validate_session(token).is_some() {
                    return next.run(req).await;
                }
            }
        }
    }

    (
        StatusCode::UNAUTHORIZED,
        Json(serde_json::json!({ "error": "Authentication required" })),
    )
        .into_response()
}

// ── Auth handlers (use Extension<SessionStore>) ────────────────────

#[derive(Deserialize)]
struct LoginRequest {
    username: String,
    password: String,
}

async fn login_handler(
    Extension(store): Extension<SessionStore>,
    Json(req): Json<LoginRequest>,
) -> Response {
    if req.username.is_empty() || req.password.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": "Username and password required" }))).into_response();
    }

    if !req.username.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == '.') {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": "Invalid username characters" }))).into_response();
    }

    match pam_authenticate(&req.username, &req.password) {
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
            return (StatusCode::OK, Json(serde_json::json!({ "authenticated": true, "username": username }))).into_response();
        }
    }
    (StatusCode::UNAUTHORIZED, Json(serde_json::json!({ "authenticated": false }))).into_response()
}

fn pam_authenticate(username: &str, password: &str) -> Result<(), String> {
    let mut client = pam::Client::with_password("login")
        .map_err(|e| format!("PAM init failed: {e}"))?;
    client.conversation_mut().set_credentials(username, password);
    client.authenticate().map_err(|e| format!("PAM auth failed: {e}"))?;
    // Skip open_session() — pam_loginuid fails under systemd with NoNewPrivileges.
    // We only need credential verification, not a full login session.
    Ok(())
}

/// Auth routes — these use Extension<SessionStore> so they can be merged
/// into Router<LibvirtManager> without state conflicts.
pub fn auth_routes(session_store: SessionStore) -> Router<LibvirtManager> {
    Router::new()
        .route("/auth/login", post(login_handler))
        .route("/auth/logout", post(logout_handler))
        .route("/auth/session", get(session_handler))
        .layer(Extension(session_store))
}
