//! Background worker for alerts, schedules, and snapshot schedules.

use machina_core::libvirt::automation_runner::run_automation_tick;
use machina_core::LibvirtManager;
use std::time::Duration;

pub fn spawn_automation_worker(manager: LibvirtManager) {
    tokio::spawn(async move {
        tracing::info!("automation worker: evaluating alerts and schedules every 60s");
        let mut interval = tokio::time::interval(Duration::from_secs(60));
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            interval.tick().await;
            let mgr = manager.clone();
            let res = tokio::task::spawn_blocking(move || run_automation_tick(&mgr)).await;
            if let Err(e) = res {
                tracing::warn!("automation worker join error: {e}");
            }
        }
    });
}
