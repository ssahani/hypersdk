use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::response::IntoResponse;
use axum::routing::get;
use axum::Router;
use tokio::time::{interval, Duration};
use tracing::info;
use virtspawn_core::LibvirtManager;

async fn ws_handler(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(handle_socket)
}

async fn handle_socket(mut socket: WebSocket) {
    info!("WebSocket client connected");

    let mut tick = interval(Duration::from_secs(2));

    loop {
        tick.tick().await;

        let msg = serde_json::json!({ "event": "refresh" });
        if socket
            .send(Message::Text(msg.to_string().into()))
            .await
            .is_err()
        {
            info!("WebSocket client disconnected");
            break;
        }
    }
}

pub fn ws_routes() -> Router<LibvirtManager> {
    Router::new().route("/watch", get(ws_handler))
}
