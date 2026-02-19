mod api;
mod config;
mod error;
mod libvirt;
mod models;
mod websocket;

use axum::routing::{delete, get, post};
use axum::Router;
use tower_http::cors::CorsLayer;
use tracing::info;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let config = config::Config::load()?;

    let manager = libvirt::LibvirtManager::new(&config.libvirt_uri)
        .map_err(|e| anyhow::anyhow!("Failed to initialize libvirt: {e}"))?;

    info!("Connected to libvirt ({})", config.libvirt_uri);

    let app = Router::new()
        .route("/api/vms", get(api::vm::list_vms))
        .route("/api/vms/{name}/start", post(api::vm::start_vm))
        .route("/api/vms/{name}/stop", post(api::vm::stop_vm))
        .route("/api/vms/{name}", delete(api::vm::delete_vm))
        .route("/ws", get(websocket::ws_handler))
        .layer(CorsLayer::permissive())
        .with_state(manager);

    let bind_addr = config.bind_addr();
    let listener = tokio::net::TcpListener::bind(&bind_addr).await?;
    info!("listening on {bind_addr}");

    axum::serve(listener, app).await?;

    Ok(())
}
