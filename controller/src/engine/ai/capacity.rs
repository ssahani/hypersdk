// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use serde::Serialize;
use sqlx::PgPool;

#[derive(Debug, Serialize)]
pub struct CapacityPlan {
    pub hosts_online: i64,
    pub memory_headroom_mib: i64,
    pub avg_cpu_percent: f32,
    pub storage_used_gib: i64,
    pub storage_capacity_gib: i64,
    pub storage_runway_days: Option<i32>,
    pub cpu_headroom_percent: f32,
    pub estimated_small_vms_addable: i64,
    pub recommendations: Vec<String>,
}

pub async fn plan(pool: &PgPool) -> anyhow::Result<CapacityPlan> {
    let hosts_online: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM hosts WHERE state = 'online'")
            .fetch_one(pool)
            .await?;
    let mem: (i64, i64) = sqlx::query_as(
        "SELECT COALESCE(SUM(memory_total_mib), 0)::bigint, COALESCE(SUM(memory_used_mib), 0)::bigint FROM hosts WHERE state = 'online'",
    )
    .fetch_one(pool)
    .await?;
    let avg_cpu: f32 = sqlx::query_scalar(
        "SELECT COALESCE(AVG(cpu_percent)::double precision, 0)::real FROM hosts WHERE state = 'online'",
    )
    .fetch_one(pool)
    .await?;
    let memory_headroom_mib = mem.0.saturating_sub(mem.1);

    let (storage_used, storage_cap): (i64, i64) = sqlx::query_as(
        "SELECT COALESCE(SUM(used_gib), 0), COALESCE(SUM(capacity_gib), 0) FROM storage_pools",
    )
    .fetch_one(pool)
    .await
    .unwrap_or((0, 0));

    let storage_runway_days = if storage_used > 0 && storage_cap > storage_used {
        let daily_growth = (storage_used as f64 * 0.02).max(1.0);
        Some(((storage_cap - storage_used) as f64 / daily_growth) as i32)
    } else {
        None
    };

    let cpu_headroom = (100.0 - avg_cpu).max(0.0);
    let mem_per_vm = 4096i64;
    let estimated_small_vms_addable = if mem_per_vm > 0 {
        memory_headroom_mib / mem_per_vm
    } else {
        0
    };

    let mut recommendations = Vec::new();
    if avg_cpu > 75.0 {
        recommendations.push("CPU pressure high — add hosts or migrate workloads.".into());
    }
    if memory_headroom_mib < 8192 {
        recommendations.push("Memory headroom low — defer large VM creates.".into());
    }
    if let Some(days) = storage_runway_days {
        if days < 30 {
            recommendations.push(format!("Storage may reach capacity in ~{days} days at current growth."));
        }
    }

    Ok(CapacityPlan {
        hosts_online,
        memory_headroom_mib,
        avg_cpu_percent: avg_cpu,
        storage_used_gib: storage_used,
        storage_capacity_gib: storage_cap,
        storage_runway_days,
        cpu_headroom_percent: cpu_headroom,
        estimated_small_vms_addable,
        recommendations,
    })
}
