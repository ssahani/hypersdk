//! In-memory time-series ring buffer for host + VM metrics.

use machina_core::config::MetricsHistoryConfig;
use machina_core::libvirt::extras::get_host_stats;
use machina_core::{LibvirtManager, VmMetrics};
use serde::Serialize;
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use std::time::Duration;

#[derive(Debug, Clone, Serialize)]
pub struct MetricsHistoryPoint {
    pub timestamp_ms: i64,
    pub host_cpu_percent: f64,
    pub host_memory_percent: f64,
    pub host_disk_percent: f64,
    pub load_1: f64,
    pub vms_running: u32,
    pub vm_count: u32,
    pub vm_metrics: Vec<VmMetrics>,
}

#[derive(Clone)]
pub struct MetricsHistoryStore {
    inner: Arc<Mutex<VecDeque<MetricsHistoryPoint>>>,
    max_points: usize,
}

impl MetricsHistoryStore {
    pub fn new(max_points: usize) -> Self {
        Self {
            inner: Arc::new(Mutex::new(VecDeque::new())),
            max_points: max_points.max(16),
        }
    }

    pub fn push(&self, point: MetricsHistoryPoint) {
        let mut q = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        q.push_back(point);
        while q.len() > self.max_points {
            q.pop_front();
        }
    }

    pub fn snapshot(&self, limit: usize) -> Vec<MetricsHistoryPoint> {
        let q = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        let lim = limit.max(1).min(q.len());
        q.iter().rev().take(lim).cloned().collect::<Vec<_>>().into_iter().rev().collect()
    }
}

pub fn spawn_metrics_history_worker(
    manager: LibvirtManager,
    store: MetricsHistoryStore,
    cfg: MetricsHistoryConfig,
) {
    if !cfg.enabled || cfg.interval_secs == 0 {
        tracing::info!("metrics history disabled");
        return;
    }
    let interval = Duration::from_secs(cfg.interval_secs.max(15));
    let store2 = store.clone();
    tokio::spawn(async move {
        tracing::info!(
            "metrics history: sample every {:?}, retain up to {} points",
            interval,
            cfg.max_points
        );
        let mut tick = tokio::time::interval(interval);
        tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            tick.tick().await;
            let mgr = manager.clone();
            let st = store2.clone();
            let _ = tokio::task::spawn_blocking(move || sample_once(&mgr, &st)).await;
        }
    });
}

fn sample_once(manager: &LibvirtManager, store: &MetricsHistoryStore) {
    let host = get_host_stats();
    let vms = manager.list_all_vms().unwrap_or_default();
    let vm_count = vms.len() as u32;
    let vms_running = vms
        .iter()
        .filter(|v| v.state.eq_ignore_ascii_case("running"))
        .count() as u32;
    let vm_metrics = manager.merge_all_metrics().unwrap_or_default();
    store.push(MetricsHistoryPoint {
        timestamp_ms: chrono::Utc::now().timestamp_millis(),
        host_cpu_percent: host.cpu_percent,
        host_memory_percent: host.memory_percent,
        host_disk_percent: host.disk_percent,
        load_1: host.load_1,
        vms_running,
        vm_count,
        vm_metrics,
    });
}
