mod advanced;
mod automation;
mod backup;
mod system;
mod console;
mod extras;
mod guacamole;
mod health;
mod host_network;
mod jobs;
mod metrics;
mod networks;
mod node;
mod prometheus;
mod snapshots;
mod storage;
mod templates;
mod vms;
mod ws;

use axum::Router;
use virtspawn_core::LibvirtManager;

pub fn api_routes() -> Router<LibvirtManager> {
    Router::new()
        .merge(jobs::job_routes())
        .merge(vms::vm_routes())
        .merge(snapshots::snapshot_routes())
        .merge(networks::network_routes())
        .merge(storage::storage_routes())
        .merge(node::node_routes())
        .merge(metrics::metrics_routes())
        .merge(health::health_routes())
        .merge(templates::template_routes())
        .merge(prometheus::prometheus_routes())
        .merge(console::console_routes())
        .merge(guacamole::guacamole_routes())
        .merge(advanced::advanced_routes())
        .merge(backup::backup_routes())
        .merge(host_network::host_network_routes())
        .merge(extras::extras_routes())
        .merge(automation::automation_routes())
        .merge(system::system_routes())
}

pub fn websocket_routes() -> Router<LibvirtManager> {
    Router::new().merge(ws::ws_routes())
}
