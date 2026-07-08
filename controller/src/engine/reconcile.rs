// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use std::time::Duration;

use uuid::Uuid;

use crate::engine::vm_lifecycle;
use crate::state::AppState;
use crate::tasks::enqueue::enqueue_task;

pub fn spawn(state: AppState) {
    tokio::spawn(async move {
        loop {
            if !state.leader.is_leader() {
                tokio::time::sleep(Duration::from_secs(10)).await;
                continue;
            }
            if let Err(e) = reconcile_once(&state).await {
                tracing::warn!("vm reconcile loop: {e:#}");
            }
            tokio::time::sleep(Duration::from_secs(60)).await;
        }
    });
}

/// Minutes to wait since the last power attempt before retrying a chronically
/// failing reconcile op: 2^fails minutes, capped at 30. `fails == 0` → no wait.
fn reconcile_backoff_minutes(recent_fails: i64) -> i64 {
    if recent_fails <= 0 {
        return 0;
    }
    (1i64 << recent_fails.min(5)).min(30)
}

async fn reconcile_once(state: &AppState) -> anyhow::Result<()> {
    let rows: Vec<(Uuid, String, String, String)> = sqlx::query_as(
        "SELECT id, name, desired_state, observed_state FROM vms
         WHERE desired_state != observed_state
           AND observed_state NOT IN ('missing', 'unknown')
           AND inventory_source = 'libvirt'
           AND lifecycle_phase NOT IN ('creating', 'migrating', 'deleting', 'snapshotting', 'backing_up', 'retired')
         LIMIT 20",
    )
    .fetch_all(&state.pool)
    .await?;

    for (vm_id, name, desired, observed) in rows {
        tracing::info!("reconcile VM {name}: desired={desired} observed={observed}");
        let host_id: Option<Uuid> = sqlx::query_scalar("SELECT host_id FROM vms WHERE id = ?")
            .bind(vm_id)
            .fetch_optional(&state.pool)
            .await?;

        let Some(host_id) = host_id else {
            continue;
        };

        let action = if desired == "running" && observed == "paused" {
            // A running-but-paused domain must be RESUMED, not started. `start`
            // errors with "domain already running", so the VM would never
            // converge and would re-enqueue a failing task every tick.
            "resume"
        } else if desired == "running" && !matches!(observed.as_str(), "running" | "blocked") {
            "start"
        } else if desired == "stopped"
            && matches!(observed.as_str(), "running" | "blocked" | "paused")
        {
            "stop"
        } else {
            continue;
        };

        // Don't pile up power tasks: if a vm.power for this VM is already pending
        // or running, skip this tick. Otherwise a VM that never converges (a start
        // that keeps failing, or a guest ignoring ACPI shutdown) would accrue a
        // fresh task — and a task_failed webhook — every 60s indefinitely.
        let inflight: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM tasks WHERE resource_id = ? AND operation = 'vm.power' AND status IN ('pending', 'running')",
        )
        .bind(vm_id)
        .fetch_one(&state.pool)
        .await
        .unwrap_or(0);
        if inflight > 0 {
            continue;
        }

        // Exponential backoff on a chronically-failing power op. The overlap guard
        // above only prevents *concurrent* tasks; a start/stop that fails fast
        // leaves the pending/running set immediately, so without backoff a VM that
        // never converges would re-enqueue — and fire a task_failed webhook —
        // every 60s forever. Space attempts by 2^fails minutes (capped at 30)
        // measured from the last attempt; recent_fails == 0 → no delay.
        let recent_fails: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM tasks
             WHERE resource_id = ? AND operation = 'vm.power' AND status = 'failed'
               AND created_at > datetime('now', '-1 hour')",
        )
        .bind(vm_id)
        .fetch_one(&state.pool)
        .await
        .unwrap_or(0);
        if recent_fails > 0 {
            let backoff_min = reconcile_backoff_minutes(recent_fails);
            let too_soon: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM tasks
                 WHERE resource_id = ? AND operation = 'vm.power'
                   AND created_at > datetime('now', ?))",
            )
            .bind(vm_id)
            .bind(format!("-{backoff_min} minutes"))
            .fetch_one(&state.pool)
            .await
            .unwrap_or(false);
            if too_soon {
                continue;
            }
        }

        if let Err(e) = enqueue_task(
            &state,
            "vm.power",
            serde_json::json!({
                "vm_id": vm_id.to_string(),
                "action": action,
                "reconcile": true,
            }),
            Some("vm"),
            Some(vm_id),
            Some(host_id),
        )
        .await
        {
            tracing::warn!(vm_id = %vm_id, action, "reconcile enqueue failed: {}", e.message);
        }

        if let Err(e) = vm_lifecycle::sync_phase_from_observed(&state.pool, vm_id).await {
            tracing::warn!(vm_id = %vm_id, "reconcile sync_phase failed: {e:#}");
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::reconcile_backoff_minutes;

    #[test]
    fn backoff_schedule() {
        assert_eq!(reconcile_backoff_minutes(0), 0); // healthy → retry immediately
        assert_eq!(reconcile_backoff_minutes(1), 2);
        assert_eq!(reconcile_backoff_minutes(2), 4);
        assert_eq!(reconcile_backoff_minutes(3), 8);
        assert_eq!(reconcile_backoff_minutes(4), 16);
        assert_eq!(reconcile_backoff_minutes(5), 30); // 32 capped to 30
        assert_eq!(reconcile_backoff_minutes(20), 30); // stays capped, no shift overflow
    }
}
