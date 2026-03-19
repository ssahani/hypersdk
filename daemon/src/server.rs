use axum::Router;
use std::path::PathBuf;
use tower_http::cors::CorsLayer;
use tower_http::services::{ServeDir, ServeFile};
use tower_http::trace::TraceLayer;
use virtspawn_core::LibvirtManager;

use crate::routes;

pub fn create_app(manager: LibvirtManager) -> Router {
    let web_dir = find_web_dist();

    let mut router = Router::new()
        .nest("/api/v1", routes::api_routes())
        .nest("/ws/v1", routes::websocket_routes());

    // Serve noVNC static files at /novnc/
    if let Some(novnc_dir) = find_novnc() {
        tracing::info!("Serving noVNC from {}", novnc_dir.display());
        router = router.nest_service("/novnc", ServeDir::new(&novnc_dir));
    }

    if let Some(dir) = web_dir {
        tracing::info!("Serving web UI from {}", dir.display());
        let index = dir.join("index.html");
        router = router.fallback_service(
            ServeDir::new(&dir).fallback(ServeFile::new(index)),
        );
    }

    router
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(manager)
}

fn find_web_dist() -> Option<PathBuf> {
    let candidates = [
        PathBuf::from("/usr/local/share/virtspawn/web"),
        PathBuf::from("/usr/share/virtspawn/web"),
        PathBuf::from("web/dist"),
        PathBuf::from("../web/dist"),
    ];
    candidates.into_iter().find(|p| p.join("index.html").exists())
}

fn find_novnc() -> Option<PathBuf> {
    let candidates = [
        PathBuf::from("/usr/share/novnc"),
        PathBuf::from("/usr/local/share/novnc"),
        PathBuf::from("/usr/share/noVNC"),
    ];
    candidates.into_iter().find(|p| p.join("vnc.html").exists())
}
