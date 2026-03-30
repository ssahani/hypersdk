use axum::middleware;
use axum::Router;
use std::path::PathBuf;
use tower_http::services::{ServeDir, ServeFile};
use tower_http::trace::TraceLayer;
use virtspawn_core::LibvirtManager;

use crate::auth::{self, SessionStore};
use crate::routes;

pub fn create_app(manager: LibvirtManager) -> Router {
    let web_dir = find_web_dist();
    let session_store = SessionStore::new();

    // All routes under /api/v1 — auth routes skip middleware internally
    let api = routes::api_routes()
        .merge(auth::auth_routes(session_store.clone()))
        .route_layer(middleware::from_fn_with_state(
            session_store.clone(),
            auth::auth_middleware,
        ))
        .with_state(manager.clone());

    // WebSocket routes don't use auth middleware — noVNC iframe can't pass
    // HttpOnly cookies, and these routes only proxy to localhost VNC/PTY ports.
    let ws = routes::websocket_routes()
        .with_state(manager);

    let mut router = Router::new()
        .nest("/api/v1", api)
        .nest("/ws/v1", ws);

    if let Some(novnc_dir) = find_novnc() {
        tracing::info!("Serving noVNC from {}", novnc_dir.display());
        router = router.nest_service("/novnc", ServeDir::new(&novnc_dir));
    }

    // Serve spice-html5 for SPICE console
    if let Some(spice_dir) = find_spice_html5() {
        tracing::info!("Serving spice-html5 from {}", spice_dir.display());
        router = router.nest_service("/spice-html5", ServeDir::new(&spice_dir));
    }

    if let Some(dir) = web_dir {
        tracing::info!("Serving web UI from {}", dir.display());
        let index = dir.join("index.html");
        router = router.fallback_service(
            ServeDir::new(&dir).fallback(ServeFile::new(index)),
        );
    }

    router.layer(TraceLayer::new_for_http())
}

fn find_web_dist() -> Option<PathBuf> {
    let exe_dir = std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.to_path_buf()));
    let mut candidates = vec![
        PathBuf::from("/usr/local/share/virtspawn/web"),
        PathBuf::from("/usr/share/virtspawn/web"),
    ];
    if let Some(ref exe) = exe_dir {
        candidates.push(exe.join("web/dist"));
    }
    candidates.push(PathBuf::from("web/dist"));
    candidates.push(PathBuf::from("../web/dist"));
    candidates.into_iter().find(|p| p.join("index.html").exists())
}

fn find_spice_html5() -> Option<PathBuf> {
    let candidates = [
        PathBuf::from("/usr/share/spice-html5"),
        PathBuf::from("/usr/local/share/spice-html5"),
    ];
    candidates.into_iter().find(|p| p.join("spice.html").exists() || p.join("spice_auto.html").exists())
}

fn find_novnc() -> Option<PathBuf> {
    let candidates = [
        PathBuf::from("/usr/share/novnc"),
        PathBuf::from("/usr/local/share/novnc"),
        PathBuf::from("/usr/share/noVNC"),
    ];
    candidates.into_iter().find(|p| p.join("vnc.html").exists())
}
