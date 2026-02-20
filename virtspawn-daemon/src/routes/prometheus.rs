use axum::extract::State;
use axum::http::header;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::Router;

use virtspawn_core::libvirt::{metrics, node};
use virtspawn_core::LibvirtManager;

async fn prometheus_metrics(State(manager): State<LibvirtManager>) -> impl IntoResponse {
    let mut output = String::new();

    // Node metrics
    if let Ok(info) = manager.with_conn(node::get_node_info) {
        output.push_str("# HELP virtspawn_node_memory_mb Total host memory in MB\n");
        output.push_str("# TYPE virtspawn_node_memory_mb gauge\n");
        output.push_str(&format!("virtspawn_node_memory_mb {}\n", info.memory_mb));

        output.push_str("# HELP virtspawn_node_cpus Total host CPU cores\n");
        output.push_str("# TYPE virtspawn_node_cpus gauge\n");
        output.push_str(&format!("virtspawn_node_cpus {}\n", info.cpu_cores));

        output.push_str("# HELP virtspawn_vms_active Number of active VMs\n");
        output.push_str("# TYPE virtspawn_vms_active gauge\n");
        output.push_str(&format!("virtspawn_vms_active {}\n", info.active_vms));

        output.push_str("# HELP virtspawn_vms_defined Number of defined VMs\n");
        output.push_str("# TYPE virtspawn_vms_defined gauge\n");
        output.push_str(&format!("virtspawn_vms_defined {}\n", info.defined_vms));
    }

    // Per-VM metrics
    if let Ok(vm_metrics) = manager.with_conn(metrics::get_all_vm_metrics) {
        output.push_str("# HELP virtspawn_vm_cpu_time_seconds_total CPU time in seconds\n");
        output.push_str("# TYPE virtspawn_vm_cpu_time_seconds_total counter\n");
        for m in &vm_metrics {
            output.push_str(&format!(
                "virtspawn_vm_cpu_time_seconds_total{{vm=\"{}\"}} {:.3}\n",
                m.name,
                m.cpu_time_ns as f64 / 1_000_000_000.0
            ));
        }

        output.push_str("# HELP virtspawn_vm_memory_used_mb Memory used in MB\n");
        output.push_str("# TYPE virtspawn_vm_memory_used_mb gauge\n");
        for m in &vm_metrics {
            output.push_str(&format!(
                "virtspawn_vm_memory_used_mb{{vm=\"{}\"}} {}\n",
                m.name, m.memory_used_mb
            ));
        }

        output.push_str("# HELP virtspawn_vm_memory_total_mb Memory total in MB\n");
        output.push_str("# TYPE virtspawn_vm_memory_total_mb gauge\n");
        for m in &vm_metrics {
            output.push_str(&format!(
                "virtspawn_vm_memory_total_mb{{vm=\"{}\"}} {}\n",
                m.name, m.memory_total_mb
            ));
        }

        output.push_str("# HELP virtspawn_vm_disk_read_bytes_total Disk read bytes\n");
        output.push_str("# TYPE virtspawn_vm_disk_read_bytes_total counter\n");
        for m in &vm_metrics {
            output.push_str(&format!(
                "virtspawn_vm_disk_read_bytes_total{{vm=\"{}\"}} {}\n",
                m.name, m.disk_rd_bytes
            ));
        }

        output.push_str("# HELP virtspawn_vm_disk_write_bytes_total Disk write bytes\n");
        output.push_str("# TYPE virtspawn_vm_disk_write_bytes_total counter\n");
        for m in &vm_metrics {
            output.push_str(&format!(
                "virtspawn_vm_disk_write_bytes_total{{vm=\"{}\"}} {}\n",
                m.name, m.disk_wr_bytes
            ));
        }

        output.push_str("# HELP virtspawn_vm_net_rx_bytes_total Network RX bytes\n");
        output.push_str("# TYPE virtspawn_vm_net_rx_bytes_total counter\n");
        for m in &vm_metrics {
            output.push_str(&format!(
                "virtspawn_vm_net_rx_bytes_total{{vm=\"{}\"}} {}\n",
                m.name, m.net_rx_bytes
            ));
        }

        output.push_str("# HELP virtspawn_vm_net_tx_bytes_total Network TX bytes\n");
        output.push_str("# TYPE virtspawn_vm_net_tx_bytes_total counter\n");
        for m in &vm_metrics {
            output.push_str(&format!(
                "virtspawn_vm_net_tx_bytes_total{{vm=\"{}\"}} {}\n",
                m.name, m.net_tx_bytes
            ));
        }
    }

    (
        [(header::CONTENT_TYPE, "text/plain; version=0.0.4; charset=utf-8")],
        output,
    )
}

pub fn prometheus_routes() -> Router<LibvirtManager> {
    Router::new().route("/prometheus", get(prometheus_metrics))
}
