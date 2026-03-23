mod error;
mod routes;
mod server;

use clap::Parser;
use tokio::signal;
use tracing::info;
use virtspawn_core::{LibvirtManager, VirtspawnConfig};

#[derive(Parser)]
#[command(name = "virtspawn-daemon", about = "virtspawn libvirt management daemon")]
struct Cli {
    /// Host to bind to
    #[arg(long)]
    host: Option<String>,

    /// Port to bind to
    #[arg(short, long)]
    port: Option<u16>,

    /// Libvirt connection URI
    #[arg(long)]
    libvirt_uri: Option<String>,

    /// Config file path
    #[arg(short, long)]
    config: Option<String>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let cli = Cli::parse();

    let mut config = if let Some(path) = &cli.config {
        let contents = std::fs::read_to_string(path)?;
        toml::from_str(&contents)?
    } else {
        VirtspawnConfig::load()
    };

    // CLI args override config
    if let Some(host) = cli.host {
        config.daemon.host = host;
    }
    if let Some(port) = cli.port {
        config.daemon.port = port;
    }
    if let Some(uri) = cli.libvirt_uri {
        config.libvirt.uri = uri;
    }

    let manager = LibvirtManager::new(&config.libvirt.uri)
        .map_err(|e| anyhow::anyhow!("{e}"))?;

    info!("Connected to libvirt ({})", config.libvirt.uri);

    let app = server::create_app(manager);

    let bind_addr = config.bind_addr();
    let listener = tokio::net::TcpListener::bind(&bind_addr).await?;
    info!("listening on {bind_addr}");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    info!("Shutting down");
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        if let Err(e) = signal::ctrl_c().await {
            tracing::error!("Failed to listen for ctrl+c: {e}");
        }
    };

    #[cfg(unix)]
    let terminate = async {
        match signal::unix::signal(signal::unix::SignalKind::terminate()) {
            Ok(mut sig) => { sig.recv().await; }
            Err(e) => tracing::error!("Failed to listen for SIGTERM: {e}"),
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}
