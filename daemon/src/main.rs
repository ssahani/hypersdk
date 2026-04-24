mod auth;
mod error;
mod job_registry;
mod kubevirt_exec;
mod routes;
mod virt_image_validate;
mod server;
mod systemd;
mod terminal;

use clap::Parser;
use tokio::signal;
use tracing::info;
use machina_core::{LibvirtManager, MachinaConfig};

#[derive(Parser)]
#[command(name = "machina-daemon", about = "machina-daemon — HTTP/WebSocket control plane for Linux hypervisor hosts (libvirt/QEMU/KVM)")]
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

fn init_rustls_crypto_provider() -> anyhow::Result<()> {
    rustls::crypto::ring::default_provider()
        .install_default()
        .map_err(|e| anyhow::anyhow!("rustls CryptoProvider::install_default: {e:?}"))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();
    init_rustls_crypto_provider()?;

    // Same idea as h2kweb: ensure under-/run paths exist for locks / future workflow use.
    for dir in ["/run/machina", "/run/machina/workflow"] {
        if let Err(e) = std::fs::create_dir_all(dir) {
            tracing::warn!("cannot create {dir}: {e}");
        }
    }

    let cli = Cli::parse();

    let mut config = if let Some(path) = &cli.config {
        let contents = std::fs::read_to_string(path)?;
        toml::from_str(&contents)?
    } else {
        MachinaConfig::load()
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
    info!("PAM service for web login: /etc/pam.d/{}", config.auth.pam_service);

    let bind_addr = config.bind_addr();
    let tls_enabled = config.tls.enabled
        && !config.tls.cert_path.is_empty()
        && !config.tls.key_path.is_empty();
    let tls_cert_path = config.tls.cert_path.clone();
    let tls_key_path = config.tls.key_path.clone();

    let app = server::create_app(manager, config);

    if tls_enabled {
        info!("listening on {bind_addr} (TLS enabled)");
        info!("  cert: {}", tls_cert_path);
        info!("  key:  {}", tls_key_path);

        let tls_config = axum_server::tls_rustls::RustlsConfig::from_pem_file(
            &tls_cert_path, &tls_key_path,
        ).await?;

        // bind_rustls opens its own listener — do not TcpListener::bind first or we get EADDRINUSE.
        systemd::notify_ready();
        systemd::spawn_watchdog_pinger();
        axum_server::bind_rustls(bind_addr.parse()?, tls_config)
            .serve(app.into_make_service())
            .await?;
    } else {
        info!("listening on {bind_addr}");
        let listener = tokio::net::TcpListener::bind(&bind_addr).await?;
        systemd::notify_ready();
        systemd::spawn_watchdog_pinger();
        axum::serve(listener, app)
            .with_graceful_shutdown(shutdown_signal())
            .await?;
    }

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
