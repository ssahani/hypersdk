//! Build OTLP/HTTP JSON payloads (metrics + logs) for OpenTelemetry collectors.

use serde_json::{json, Value};

use crate::metrics_history::MetricsHistoryPoint;
use crate::state::AuditEvent;

fn now_unix_nano() -> String {
    chrono::Utc::now()
        .timestamp_nanos_opt()
        .unwrap_or(0)
        .to_string()
}

fn attr_str(key: &str, v: &str) -> Value {
    json!({ "key": key, "value": { "stringValue": v } })
}

fn resource_attrs(service: &str, host: &str) -> Vec<Value> {
    vec![
        attr_str("service.name", service),
        attr_str("host.name", host),
    ]
}

fn gauge_metric(name: &str, value: f64, attrs: Vec<Value>) -> Value {
    json!({
        "name": name,
        "gauge": {
            "dataPoints": [{
                "attributes": attrs,
                "timeUnixNano": now_unix_nano(),
                "asDouble": value
            }]
        }
    })
}

fn sum_metric(name: &str, value: f64, attrs: Vec<Value>, cumulative: bool) -> Value {
    json!({
        "name": name,
        "sum": {
            "aggregationTemporality": if cumulative { 2 } else { 1 },
            "isMonotonic": true,
            "dataPoints": [{
                "attributes": attrs,
                "timeUnixNano": now_unix_nano(),
                "asDouble": value
            }]
        }
    })
}

/// OTLP metrics JSON body from a metrics-history sample.
pub fn build_metrics_export_payload(
    hostname: &str,
    point: &MetricsHistoryPoint,
    daemon_uptime_secs: u64,
    auth_failures: u64,
) -> Value {
    let mut metrics: Vec<Value> = Vec::new();
    metrics.push(gauge_metric(
        "machina.host.cpu_percent",
        point.host_cpu_percent,
        vec![],
    ));
    metrics.push(gauge_metric(
        "machina.host.memory_percent",
        point.host_memory_percent,
        vec![],
    ));
    metrics.push(gauge_metric(
        "machina.host.disk_percent",
        point.host_disk_percent,
        vec![],
    ));
    metrics.push(gauge_metric("machina.host.load_1", point.load_1, vec![]));
    metrics.push(gauge_metric(
        "machina.vms.running",
        point.vms_running as f64,
        vec![],
    ));
    metrics.push(gauge_metric(
        "machina.vms.defined",
        point.vm_count as f64,
        vec![],
    ));
    metrics.push(gauge_metric(
        "machina.daemon.uptime_seconds",
        daemon_uptime_secs as f64,
        vec![],
    ));
    metrics.push(sum_metric(
        "machina.daemon.auth_failures_total",
        auth_failures as f64,
        vec![],
        true,
    ));

    for vm in &point.vm_metrics {
        let mut attrs = vec![attr_str("vm.name", &vm.name)];
        if let Some(c) = &vm.libvirt_connection {
            attrs.push(attr_str("libvirt.connection", c));
        }
        metrics.push(gauge_metric(
            "machina.vm.memory_percent",
            vm.memory_pct,
            attrs.clone(),
        ));
        metrics.push(gauge_metric(
            "machina.vm.memory_used_mb",
            vm.memory_used_mb as f64,
            attrs.clone(),
        ));
        metrics.push(sum_metric(
            "machina.vm.disk_read_bytes_total",
            vm.disk_rd_bytes as f64,
            attrs.clone(),
            true,
        ));
        metrics.push(sum_metric(
            "machina.vm.disk_write_bytes_total",
            vm.disk_wr_bytes as f64,
            attrs.clone(),
            true,
        ));
        metrics.push(sum_metric(
            "machina.vm.net_rx_bytes_total",
            vm.net_rx_bytes as f64,
            attrs.clone(),
            true,
        ));
        metrics.push(sum_metric(
            "machina.vm.net_tx_bytes_total",
            vm.net_tx_bytes as f64,
            attrs,
            true,
        ));
    }

    json!({
        "resourceMetrics": [{
            "resource": { "attributes": resource_attrs("machina-daemon", hostname) },
            "scopeMetrics": [{
                "scope": { "name": "machina" },
                "metrics": metrics
            }]
        }]
    })
}

/// OTLP logs JSON body for Machina audit events.
pub fn build_logs_export_payload(hostname: &str, events: &[AuditEvent]) -> Value {
    let records: Vec<Value> = events
        .iter()
        .map(|e| {
            let body = if e.actor.is_empty() {
                format!("{} {} {} {}", e.timestamp, e.action, e.target, e.result)
            } else {
                format!(
                    "{} {} {} {} actor={}",
                    e.timestamp, e.action, e.target, e.result, e.actor
                )
            };
            json!({
                "timeUnixNano": now_unix_nano(),
                "severityNumber": if e.result.eq_ignore_ascii_case("ok") || e.result.eq_ignore_ascii_case("success") { 9 } else { 13 },
                "severityText": e.result,
                "body": { "stringValue": body },
                "attributes": [
                    attr_str("machina.audit.action", &e.action),
                    attr_str("machina.audit.target", &e.target),
                    attr_str("machina.audit.result", &e.result),
                    attr_str("machina.audit.actor", &e.actor),
                ]
            })
        })
        .collect();

    json!({
        "resourceLogs": [{
            "resource": { "attributes": resource_attrs("machina-daemon", hostname) },
            "scopeLogs": [{
                "scope": { "name": "machina.audit" },
                "logRecords": records
            }]
        }]
    })
}
