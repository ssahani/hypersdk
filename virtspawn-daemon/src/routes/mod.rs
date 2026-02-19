mod networks;
mod node;
mod snapshots;
mod storage;
mod vms;
mod ws;

use axum::Router;
use virtspawn_core::LibvirtManager;

pub fn api_routes() -> Router<LibvirtManager> {
    Router::new()
        .merge(vms::vm_routes())
        .merge(snapshots::snapshot_routes())
        .merge(networks::network_routes())
        .merge(storage::storage_routes())
        .merge(node::node_routes())
}

pub fn websocket_routes() -> Router<LibvirtManager> {
    Router::new().merge(ws::ws_routes())
}
