mod vms;
mod ws;

use axum::Router;
use virtspawn_core::LibvirtManager;

pub fn api_routes() -> Router<LibvirtManager> {
    Router::new().merge(vms::vm_routes())
}

pub fn websocket_routes() -> Router<LibvirtManager> {
    Router::new().merge(ws::ws_routes())
}
