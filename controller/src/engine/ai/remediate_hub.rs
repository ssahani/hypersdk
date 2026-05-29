// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use serde::Serialize;
use sqlx::PgPool;

#[derive(Debug, Serialize)]
pub struct RemediationItem {
    pub id: String,
    pub source: String,
    pub label: String,
    pub review: String,
    pub action: String,
    pub priority: u8,
    pub risk: String,
}

#[derive(Debug, Serialize)]
pub struct RemediateHub {
    pub items: Vec<RemediationItem>,
    pub summary: String,
}

pub async fn hub(pool: &PgPool) -> anyhow::Result<RemediateHub> {
    let sre = super::sre_remediate::propose(pool).await?;
    let compliance = super::compliance_remediate::propose(pool).await?;
    let power = super::fleet_power::optimize(pool).await?;

    let mut items = Vec::new();

    let sre_count = sre.remediations.len();
    let compliance_count = compliance.remediations.len();
    let power_count = power.optimizations.len().min(5);

    for r in sre.remediations {
        items.push(RemediationItem {
            id: r.id,
            source: "sre".into(),
            label: r.label,
            review: r.review,
            action: r.action,
            priority: r.priority,
            risk: r.risk,
        });
    }

    for (i, r) in compliance.remediations.iter().enumerate() {
        items.push(RemediationItem {
            id: r.id.clone(),
            source: "compliance".into(),
            label: r.label.clone(),
            review: r.review.clone(),
            action: r.action.clone(),
            priority: 2 + i as u8,
            risk: r.risk.clone(),
        });
    }

    for (i, o) in power.optimizations.iter().enumerate().take(5) {
        items.push(RemediationItem {
            id: format!("power-{}", i),
            source: "fleet".into(),
            label: format!("Optimize {}", o.host),
            review: o.reason.clone(),
            action: o.action.clone(),
            priority: 3,
            risk: "Low".into(),
        });
    }

    items.sort_by_key(|i| i.priority);

    let summary = if items.is_empty() {
        "Remediation hub clear — no open SRE, compliance, or fleet actions.".into()
    } else {
        format!(
            "{} unified remediation(s): {} SRE · {} compliance · {} fleet",
            items.len(),
            sre_count,
            compliance_count,
            power_count
        )
    };

    Ok(RemediateHub { items, summary })
}
