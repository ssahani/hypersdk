use axum::Router;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use virtspawn_core::LibvirtManager;

use crate::routes;

pub fn create_app(manager: LibvirtManager) -> Router {
    Router::new()
        .nest("/api/v1", routes::api_routes())
        .nest("/ws/v1", routes::websocket_routes())
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(manager)
}
