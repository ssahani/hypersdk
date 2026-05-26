//! In-memory time-series ring buffer for host + VM metrics, with optional JSON Lines persistence.

use machina_core::config::MetricsHistoryConfig;
use machina_core::libvirt::extras::get_host_stats;
use machina_core::metrics_history::{
    append_metrics_history_point, load_metrics_history_points, metrics_history_jsonl_path,
    MetricsHistoryPoint,
};
use machina_core::LibvirtManager;
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use std::time::Duration;

pub use machina_core::metrics_history::MetricsHistoryPoint as HistoryPoint;

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

    pub fn load_from_disk(&self, limit: usize) {
        let points = load_metrics_history_points(limit);
        if points.is_empty() {
            return;
        }
        let mut q = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        q.clear();
        for p in points {
            q.push_back(p);
        }
        while q.len() > self.max_points {
            q.pop_front();
        }
        tracing::info!(
            "loaded {} metrics history point(s) from {}",
            q.len(),
            metrics_history_jsonl_path().display()
        );
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
        q.iter()
            .rev()
            .take(lim)
            .cloned()
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect()
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
    if cfg.persist {
        store.load_from_disk(cfg.max_points);
    }
    let interval = Duration::from_secs(cfg.interval_secs.max(15));
    let store2 = store.clone();
    let persist = cfg.persist;
    let max_file_mb = cfg.max_file_mb;
    tokio::spawn(async move {
        let persist_note = if persist {
            format!(
                ", persist → {} (max {} MiB)",
                metrics_history_jsonl_path().display(),
                max_file_mb
            )
        } else {
            String::new()
        };
        tracing::info!(
            "metrics history: sample every {:?}, retain {} points{}",
            interval,
            cfg.max_points,
            persist_note
        );
        let mut tick = tokio::time::interval(interval);
        tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            tick.tick().await;
            let mgr = manager.clone();
            let st = store2.clone();
            let _ = tokio::task::spawn_blocking(move || {
                sample_once(&mgr, &st, persist, max_file_mb)
            })
            .await;
        }
    });
}

fn sample_once(
    manager: &LibvirtManager,
    store: &MetricsHistoryStore,
    persist: bool,
    max_file_mb: u64,
) {
    let host = get_host_stats();
    let vms = manager.list_all_vms().unwrap_or_default();
    let vm_count = vms.len() as u32;
    let vms_running = vms
        .iter()
        .filter(|v| v.state.eq_ignore_ascii_case("running"))
        .count() as u32;
    let vm_metrics = manager.merge_all_metrics().unwrap_or_default();
    let point = MetricsHistoryPoint {
        timestamp_ms: chrono::Utc::now().timestamp_millis(),
        host_cpu_percent: host.cpu_percent,
        host_memory_percent: host.memory_percent,
        host_disk_percent: host.disk_percent,
        load_1: host.load_1,
        vms_running,
        vm_count,
        vm_metrics,
    };
    store.push(point.clone());
    if persist {
        if let Err(e) = append_metrics_history_point(&point, max_file_mb) {
            tracing::warn!("metrics history persist failed: {e}");
        }
    }
}
