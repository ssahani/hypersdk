use axum::Router;
use std::path::PathBuf;
use tower_http::cors::{CorsLayer, AllowOrigin};
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

    // Only allow same-origin requests (the web UI is served from the same host)
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::mirror_request())
        .allow_methods(tower_http::cors::Any)
        .allow_headers(tower_http::cors::Any);

    router
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(manager)
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

fn find_novnc() -> Option<PathBuf> {
    let candidates = [
        PathBuf::from("/usr/share/novnc"),
        PathBuf::from("/usr/local/share/novnc"),
        PathBuf::from("/usr/share/noVNC"),
    ];
    candidates.into_iter().find(|p| p.join("vnc.html").exists())
}
