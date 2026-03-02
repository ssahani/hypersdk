use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::Router;
use tokio::time::{interval, Duration};
use tracing::info;
use virtspawn_core::libvirt::domain;
use virtspawn_core::LibvirtManager;

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(manager): State<LibvirtManager>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, manager))
}

async fn handle_socket(mut socket: WebSocket, manager: LibvirtManager) {
    info!("WebSocket client connected");

    let mut tick = interval(Duration::from_secs(2));
    let mut prev_states: Vec<(String, String)> = Vec::new();

    loop {
        tick.tick().await;

        let current = manager
            .with_conn(domain::list_vms)
            .unwrap_or_default();

        let current_states: Vec<(String, String)> = current
            .iter()
            .map(|vm| (vm.name.clone(), vm.state.clone()))
            .collect();

        // Detect changes
        let mut changes = Vec::new();
        for (name, state) in &current_states {
            match prev_states.iter().find(|(n, _)| n == name) {
                Some((_, old_state)) if old_state != state => {
                    changes.push(serde_json::json!({
                        "event": "state_change",
                        "name": name,
                        "old_state": old_state,
                        "new_state": state,
                    }));
                }
                None => {
                    changes.push(serde_json::json!({
                        "event": "vm_added",
                        "name": name,
                        "state": state,
                    }));
                }
                _ => {}
            }
        }

        for (name, _) in &prev_states {
            if !current_states.iter().any(|(n, _)| n == name) {
                changes.push(serde_json::json!({
                    "event": "vm_removed",
                    "name": name,
                }));
            }
        }

        prev_states = current_states;

        let msg = if changes.is_empty() {
            serde_json::json!({
                "event": "heartbeat",
                "vm_count": current.len(),
            })
        } else {
            serde_json::json!({
                "event": "changes",
                "changes": changes,
            })
        };

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
