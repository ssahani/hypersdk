mod api;
mod app;
mod ui;

use app::App;
use virtspawn_core::VirtspawnConfig;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let original_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |panic_info| {
        let _ = ratatui::restore();
        original_hook(panic_info);
    }));

    let config = VirtspawnConfig::load();
    let client = api::DaemonClient::new(&config.daemon_url());
    let mut app = App::new(client, config.general.refresh_interval_secs);

    let terminal = ratatui::init();
    let result = app.run(terminal).await;

    ratatui::restore();
    result
}
