// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::extract::State;
use axum::Json;
use serde::Serialize;

use crate::api::ApiError;
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct CapacityReport {
    pub hosts_online: i64,
    pub hosts_offline: i64,
    pub total_vms: i64,
    pub running_vms: i64,
    pub memory_total_mib: i64,
    pub memory_used_mib: i64,
    pub memory_headroom_mib: i64,
    pub avg_cpu_percent: f32,
}

#[derive(Debug, Serialize)]
pub struct FinOpsReport {
    pub vm_count: i64,
    pub running_vms: i64,
    pub total_vcpu: i64,
    pub total_memory_gib: f64,
    pub vcpu_hour_usd: f64,
    pub gib_hour_usd: f64,
    pub estimated_monthly_usd: f64,
}

pub async fn finops_report(
    State(state): State<AppState>,
) -> Result<Json<FinOpsReport>, ApiError> {
    let rates: (f64, f64) = sqlx::query_as(
        "SELECT finops_vcpu_hour_usd, finops_gib_hour_usd FROM clusters ORDER BY created_at LIMIT 1",
    )
    .fetch_one(&state.pool)
    .await?;
    let vm_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM vms")
        .fetch_one(&state.pool)
        .await?;
    let running_vms: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM vms WHERE observed_state = 'running'")
            .fetch_one(&state.pool)
            .await?;
    let totals: (i64, i64) = sqlx::query_as(
        "SELECT COALESCE(SUM(vcpus), 0)::bigint, COALESCE(SUM(memory_mib), 0)::bigint FROM vms",
    )
    .fetch_one(&state.pool)
    .await?;
    let memory_gib = totals.1 as f64 / 1024.0;
    let hourly = totals.0 as f64 * rates.0 + memory_gib * rates.1;
    Ok(Json(FinOpsReport {
        vm_count,
        running_vms,
        total_vcpu: totals.0,
        total_memory_gib: memory_gib,
        vcpu_hour_usd: rates.0,
        gib_hour_usd: rates.1,
        estimated_monthly_usd: hourly * 730.0,
    }))
}

pub async fn capacity_report(
    State(state): State<AppState>,
) -> Result<Json<CapacityReport>, ApiError> {
    let hosts_online: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM hosts WHERE state = 'online'")
            .fetch_one(&state.pool)
            .await?;
    let hosts_offline: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM hosts WHERE state = 'offline'")
            .fetch_one(&state.pool)
            .await?;
    let total_vms: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM vms")
        .fetch_one(&state.pool)
        .await?;
    let running_vms: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM vms WHERE observed_state = 'running'")
            .fetch_one(&state.pool)
            .await?;
    let mem: (i64, i64) = sqlx::query_as(
        "SELECT COALESCE(SUM(memory_total_mib), 0)::bigint, COALESCE(SUM(memory_used_mib), 0)::bigint FROM hosts WHERE state = 'online'",
    )
    .fetch_one(&state.pool)
    .await?;
    let avg_cpu: f32 = sqlx::query_scalar(
        "SELECT COALESCE(AVG(cpu_percent)::double precision, 0)::real FROM hosts WHERE state = 'online'",
    )
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(CapacityReport {
        hosts_online,
        hosts_offline,
        total_vms,
        running_vms,
        memory_total_mib: mem.0,
        memory_used_mib: mem.1,
        memory_headroom_mib: mem.0.saturating_sub(mem.1),
        avg_cpu_percent: avg_cpu,
    }))
}
