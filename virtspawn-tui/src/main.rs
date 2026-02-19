mod api;
mod app;
mod ui;

use app::App;
use clap::Parser;
use virtspawn_core::VirtspawnConfig;

#[derive(Parser)]
#[command(name = "virtspawn", about = "virtspawn TUI - libvirt VM manager")]
struct Cli {
    /// Daemon URL (e.g. http://127.0.0.1:8081)
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
        let _ = ratatui::restore();
        original_hook(panic_info);
    }));

    let cli = Cli::parse();

    let config = if let Some(path) = &cli.config {
        let contents = std::fs::read_to_string(path)?;
        toml::from_str(&contents)?
    } else {
        VirtspawnConfig::load()
    };

    let daemon_url = cli.url.unwrap_or_else(|| config.daemon_url());
    let refresh_secs = cli.refresh.unwrap_or(config.general.refresh_interval_secs);

    let client = api::DaemonClient::new(&daemon_url);
    let mut app = App::new(client, refresh_secs);

    let terminal = ratatui::init();
    let result = app.run(terminal).await;

    ratatui::restore();
    result
}
