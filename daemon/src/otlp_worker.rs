//! Periodic OTLP/HTTP export of metrics and audit logs.

use machina_core::config::OtlpExportConfig;
use machina_core::libvirt::extras::get_host_stats;
use machina_core::metrics_history::MetricsHistoryPoint;
use machina_core::otlp::{build_logs_export_payload, build_metrics_export_payload};
use machina_core::{audit_ship, LibvirtManager};
use std::sync::Arc;
use std::time::Duration;

use crate::daemon_stats::DaemonStats;

fn normalize_endpoint(base: &str, path: &str) -> String {
    let base = base.trim_end_matches('/');
    if base.ends_with(path) {
        base.to_string()
    } else {
        format!("{base}{path}")
    }
}

fn post_otlp(
    client: &reqwest::Client,
    url: &str,
    auth: &str,
    body: serde_json::Value,
) -> Result<(), String> {
    let mut req = client
        .post(url)
        .header("Content-Type", "application/json")
        .json(&body);
    if !auth.is_empty() {
        req = req.header("Authorization", auth);
    }
    let res = req
        .send()
        .map_err(|e| format!("request: {e}"))?;
    if res.status().is_success() {
        Ok(())
    } else {
        Err(format!("HTTP {}", res.status()))
    }
}

fn sample_point(manager: &LibvirtManager) -> MetricsHistoryPoint {
    let host = get_host_stats();
    let vms = manager.list_all_vms().unwrap_or_default();
    let vm_count = vms.len() as u32;
    let vms_running = vms
        .iter()
        .filter(|v| v.state.eq_ignore_ascii_case("running"))
        .count() as u32;
    let vm_metrics = manager.merge_all_metrics().unwrap_or_default();
    MetricsHistoryPoint {
        timestamp_ms: chrono::Utc::now().timestamp_millis(),
        host_cpu_percent: host.cpu_percent,
        host_memory_percent: host.memory_percent,
        host_disk_percent: host.disk_percent,
        load_1: host.load_1,
        vms_running,
        vm_count,
        vm_metrics,
    }
}

pub fn spawn_otlp_worker(
    manager: LibvirtManager,
    cfg: OtlpExportConfig,
    stats: Arc<DaemonStats>,
) {
    if !cfg.is_enabled() {
        return;
    }
    let interval = Duration::from_secs(cfg.interval_secs.max(30));
    let endpoint = cfg.endpoint.clone();
    let auth = cfg.authorization.clone();
    let export_metrics = cfg.export_metrics;
    let export_logs = cfg.export_logs;

    tokio::spawn(async move {
        let client = match reqwest::Client::builder()
            .timeout(Duration::from_secs(20))
            .build()
        {
            Ok(c) => c,
            Err(e) => {
                tracing::error!("OTLP export: HTTP client: {e}");
                return;
            }
        };
        let metrics_url = normalize_endpoint(&endpoint, "/v1/metrics");
        let logs_url = normalize_endpoint(&endpoint, "/v1/logs");
        tracing::info!(
            "OTLP export every {:?} → metrics={} logs={}",
            interval,
            metrics_url,
            logs_url
        );

        let hostname = std::fs::read_to_string("/etc/hostname")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "machina-host".into());
        let hostname2 = hostname.clone();

        let mut tick = tokio::time::interval(interval);
        tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            tick.tick().await;
            let mgr = manager.clone();
            let client2 = client.clone();
            let metrics_url2 = metrics_url.clone();
            let logs_url2 = logs_url.clone();
            let auth2 = auth.clone();
            let hostname3 = hostname2.clone();
            let stats2 = stats.clone();
            let export_metrics2 = export_metrics;
            let export_logs2 = export_logs;

            let _ = tokio::task::spawn_blocking(move || {
                if export_metrics2 {
                    let point = sample_point(&mgr);
                    let body = build_metrics_export_payload(
                        &hostname3,
                        &point,
                        stats2.uptime_seconds(),
                        stats2.auth_failures(),
                    );
                    match post_otlp(&client2, &metrics_url2, &auth2, body) {
                        Ok(()) => tracing::debug!("OTLP metrics export ok"),
                        Err(e) => tracing::warn!("OTLP metrics export failed: {e}"),
                    }
                }
                if export_logs2 {
                    let events = audit_ship::recent_events_for_otlp(80);
                    if !events.is_empty() {
                        let body = build_logs_export_payload(&hostname3, &events);
                        match post_otlp(&client2, &logs_url2, &auth2, body) {
                            Ok(()) => tracing::debug!("OTLP logs export ok ({} events)", events.len()),
                            Err(e) => tracing::warn!("OTLP logs export failed: {e}"),
                        }
                    }
                }
            })
            .await;
        }
    });
}
