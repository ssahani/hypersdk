use axum::extract::State;
use axum::http::header;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::Router;
use std::fmt::Display;

use virtspawn_core::libvirt::{metrics, node};
use virtspawn_core::LibvirtManager;

fn add_gauge(output: &mut String, name: &str, help: &str, value: impl Display) {
    output.push_str(&format!("# HELP {name} {help}\n# TYPE {name} gauge\n{name} {value}\n"));
}

fn escape_label(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"").replace('\n', "\\n")
}

fn add_labeled(output: &mut String, name: &str, label: &str, value: impl Display) {
    output.push_str(&format!("{name}{{vm=\"{}\"}} {value}\n", escape_label(label)));
}

fn add_vm_metric(output: &mut String, name: &str, help: &str, metric_type: &str, vm_metrics: &[virtspawn_core::VmMetrics], extract: impl Fn(&virtspawn_core::VmMetrics) -> String) {
    output.push_str(&format!("# HELP {name} {help}\n# TYPE {name} {metric_type}\n"));
    for m in vm_metrics {
        add_labeled(output, name, &m.name, extract(m));
    }
}

async fn prometheus_metrics(State(manager): State<LibvirtManager>) -> impl IntoResponse {
    let mut output = String::new();

    if let Ok(info) = manager.with_conn(node::get_node_info) {
        add_gauge(&mut output, "virtspawn_node_memory_mb", "Total host memory in MB", info.memory_mb);
        add_gauge(&mut output, "virtspawn_node_cpus", "Total host CPU cores", info.cpu_cores);
        add_gauge(&mut output, "virtspawn_vms_active", "Number of active VMs", info.active_vms);
        add_gauge(&mut output, "virtspawn_vms_defined", "Number of defined VMs", info.defined_vms);
    }

    if let Ok(vm_metrics) = manager.with_conn(metrics::get_all_vm_metrics) {
        add_vm_metric(&mut output, "virtspawn_vm_cpu_time_seconds_total", "CPU time in seconds", "counter", &vm_metrics,
            |m| format!("{:.3}", m.cpu_time_ns as f64 / 1_000_000_000.0));
        add_vm_metric(&mut output, "virtspawn_vm_memory_used_mb", "Memory used in MB", "gauge", &vm_metrics,
            |m| m.memory_used_mb.to_string());
        add_vm_metric(&mut output, "virtspawn_vm_memory_total_mb", "Memory total in MB", "gauge", &vm_metrics,
            |m| m.memory_total_mb.to_string());
        add_vm_metric(&mut output, "virtspawn_vm_disk_read_bytes_total", "Disk read bytes", "counter", &vm_metrics,
            |m| m.disk_rd_bytes.to_string());
        add_vm_metric(&mut output, "virtspawn_vm_disk_write_bytes_total", "Disk write bytes", "counter", &vm_metrics,
            |m| m.disk_wr_bytes.to_string());
        add_vm_metric(&mut output, "virtspawn_vm_net_rx_bytes_total", "Network RX bytes", "counter", &vm_metrics,
            |m| m.net_rx_bytes.to_string());
        add_vm_metric(&mut output, "virtspawn_vm_net_tx_bytes_total", "Network TX bytes", "counter", &vm_metrics,
            |m| m.net_tx_bytes.to_string());
    }

    ([(header::CONTENT_TYPE, "text/plain; version=0.0.4; charset=utf-8")], output)
}

pub fn prometheus_routes() -> Router<LibvirtManager> {
    Router::new().route("/prometheus", get(prometheus_metrics))
}
