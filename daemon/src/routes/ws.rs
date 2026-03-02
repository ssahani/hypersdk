use std::collections::HashMap;

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
    let mut prev_states: HashMap<String, String> = HashMap::new();

    loop {
        tick.tick().await;

        let current = manager
            .with_conn(domain::list_vms)
            .unwrap_or_default();

        let mut changes = Vec::new();
        let mut current_names: HashMap<String, String> = HashMap::with_capacity(current.len());

        for vm in &current {
            match prev_states.get(&vm.name) {
                Some(old_state) if *old_state != vm.state => {
                    changes.push(serde_json::json!({
                        "event": "state_change",
                        "name": vm.name,
                        "old_state": old_state,
                        "new_state": vm.state,
                    }));
                }
                None => {
                    changes.push(serde_json::json!({
                        "event": "vm_added",
                        "name": vm.name,
                        "state": vm.state,
                    }));
                }
                _ => {}
            }
            current_names.insert(vm.name.clone(), vm.state.clone());
        }

        for name in prev_states.keys() {
            if !current_names.contains_key(name) {
                changes.push(serde_json::json!({
                    "event": "vm_removed",
                    "name": name,
                }));
            }
        }

        prev_states = current_names;

        let msg = if changes.is_empty() {
            serde_json::json!({ "event": "heartbeat", "vm_count": current.len() })
        } else {
            serde_json::json!({ "event": "changes", "changes": changes })
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
