mod error;
mod routes;
mod server;

use tracing::info;
use virtspawn_core::{LibvirtManager, VirtspawnConfig};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let config = VirtspawnConfig::load();

    let manager = LibvirtManager::new(&config.libvirt.uri)
        .map_err(|e| anyhow::anyhow!("{e}"))?;

    info!("Connected to libvirt ({})", config.libvirt.uri);

    let app = server::create_app(manager);

    let bind_addr = config.bind_addr();
    let listener = tokio::net::TcpListener::bind(&bind_addr).await?;
    info!("listening on {bind_addr}");

    axum::serve(listener, app).await?;

    Ok(())
}
