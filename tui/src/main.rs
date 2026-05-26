// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

mod api;
mod app;
mod ui;

use app::App;
use clap::Parser;
use machina_core::MachinaConfig;

#[derive(Parser)]
#[command(
    name = "machina",
    about = "machina TUI — terminal client for Linux hypervisor hosts (libvirt/QEMU/KVM)"
)]
struct Cli {
    /// Daemon URL (default from config uses https when [tls] is enabled; packaged install enables TLS)
    #[arg(short, long)]
    url: Option<String>,

    /// Config file path
    #[arg(short, long)]
    config: Option<String>,

    /// Refresh interval in seconds
    #[arg(short, long)]
    refresh: Option<u64>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let original_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |panic_info| {
        ratatui::restore();
        original_hook(panic_info);
    }));

    let cli = Cli::parse();

    let config = if let Some(path) = &cli.config {
        let contents = std::fs::read_to_string(path)?;
        toml::from_str(&contents)?
    } else {
        MachinaConfig::load()
    };

    let daemon_url = cli.url.unwrap_or_else(|| config.daemon_url());
    let refresh_secs = cli.refresh.unwrap_or(config.general.refresh_interval_secs);

    let client = api::DaemonClient::new(&daemon_url);
    let mut app = App::new(client, refresh_secs);

    crossterm::execute!(std::io::stdout(), crossterm::event::EnableMouseCapture)?;

    let terminal = ratatui::init();
    let result = app.run(terminal).await;

    crossterm::execute!(std::io::stdout(), crossterm::event::DisableMouseCapture)?;
    ratatui::restore();
    result
}
