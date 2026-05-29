// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use serde::Serialize;
use sqlx::PgPool;

#[derive(Debug, Serialize)]
pub struct ZeusOsSummary {
    pub status: String,
    pub tagline: String,
    pub hosts_online: i64,
    pub vm_count: i64,
    pub monthly_cost_usd: f64,
    pub security_risk: String,
    pub sre_alerts: usize,
    pub fleet_hotspots: usize,
    pub compliance_grade: String,
    pub highlights: Vec<String>,
}

pub async fn summarize(pool: &PgPool) -> anyhow::Result<ZeusOsSummary> {
    let hosts_online: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM hosts WHERE state = 'online'")
            .fetch_one(pool)
            .await?;
    let vm_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM vms")
        .fetch_one(pool)
        .await?;

    let cost = super::cost::analyze(pool).await?;
    let security = super::security::scan(pool).await?;
    let sre = super::sre_predict::forecast(pool).await?;
    let heat = super::fleet_heatmap::heatmap(pool).await?;
    let compliance = super::compliance::generate(pool).await?;

    let status = if security.risk_level == "high" || sre.forecasts.iter().any(|f| f.severity == "critical") {
        "attention"
    } else if heat.hotspots.is_empty() {
        "healthy"
    } else {
        "watch"
    };

    let mut highlights = Vec::new();
    if !heat.hotspots.is_empty() {
        highlights.push(format!("{} fleet hotspot(s)", heat.hotspots.len()));
    }
    if cost.idle_vm_count > 0 {
        highlights.push(format!("{} idle VMs — FinOps opportunity", cost.idle_vm_count));
    }
    if sre.forecasts.len() > 0 {
        highlights.push(format!("{} SRE forecast(s)", sre.forecasts.len()));
    }
    if highlights.is_empty() {
        highlights.push("Autonomous datacenter operating within guardrails.".into());
    }

    Ok(ZeusOsSummary {
        status: status.into(),
        tagline: "Machina Zeus OS — AI-native infrastructure operating system".into(),
        hosts_online,
        vm_count,
        monthly_cost_usd: cost.estimated_monthly_usd,
        security_risk: security.risk_level,
        sre_alerts: sre.forecasts.len(),
        fleet_hotspots: heat.hotspots.len(),
        compliance_grade: compliance.grade,
        highlights,
    })
}
