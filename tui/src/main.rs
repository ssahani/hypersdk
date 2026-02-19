mod api;
mod app;
mod ui;

use app::App;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let original_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |panic_info| {
        let _ = ratatui::restore();
        original_hook(panic_info);
    }));

    let client = api::DaemonClient::new("http://127.0.0.1:8081");
    let mut app = App::new(client);

    let terminal = ratatui::init();
    let result = app.run(terminal).await;

    ratatui::restore();
    result
}
