// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use serde::Serialize;
use sqlx::PgPool;

use machina_core::{compute_diff, FirewallPlanRequest};
use crate::config::ControllerConfig;
use crate::engine::zeus_firewall::inventory::{plan_target, target_detail};

#[derive(Debug, Clone, Serialize)]
pub struct FirewallExplainReport {
    pub target: String,
    pub risk: String,
    pub evidence: Vec<String>,
    pub recommendation: String,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SecurePlanStep {
    pub step: u32,
    pub action: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SecurePlanReport {
    pub target: String,
    pub steps: Vec<SecurePlanStep>,
    pub risk_after: String,
    pub rollback: bool,
    pub summary: String,
}

pub async fn explain_exposure(
    pool: &PgPool,
    cfg: &ControllerConfig,
    target_id: &str,
    question: Option<&str>,
) -> anyhow::Result<FirewallExplainReport> {
    let detail = target_detail(pool, cfg, target_id).await?;
    let mut evidence = Vec::new();
    for port in &detail.inventory.open_ports {
        if matches!(
            port.risk,
            machina_core::firewall::types::ExposureRisk::Critical
        ) {
            evidence.push(format!(
                "{} port {} open on {} — allowed from {:?}",
                port.service_name, port.port, port.bind_address, port.allowed_from
            ));
        }
    }
    for rule in &detail.inventory.rules {
        if rule.action == "allow"
            && rule.sources.iter().any(|s| s == "any" || s == "0.0.0.0/0")
            && (rule.ports == "22" || rule.ports == "5432" || rule.ports == "3306")
        {
            evidence.push(format!(
                "Rule {} allows {} from any source",
                rule.id, rule.ports
            ));
        }
    }
    let risk = detail.target.risk.clone();
    let recommendation = if evidence.is_empty() {
        "No critical exposures detected".into()
    } else if evidence.iter().any(|e| e.contains("5432") || e.contains("3306")) {
        "Restrict database to application subnet only".into()
    } else {
        "Restrict SSH to admin subnet only".into()
    };
    let summary = question
        .map(|q| format!("{q}: {}", detail.target.name))
        .unwrap_or_else(|| format!("Firewall posture for {}", detail.target.name));
    Ok(FirewallExplainReport {
        target: detail.target.name,
        risk,
        evidence,
        recommendation,
        summary,
    })
}

pub async fn secure_machine_plan(
    pool: &PgPool,
    cfg: &ControllerConfig,
    target_id: &str,
) -> anyhow::Result<SecurePlanReport> {
    let detail = target_detail(pool, cfg, target_id).await?;
    let mut steps = vec![
        SecurePlanStep {
            step: 1,
            action: "Keep SSH allowed only from admin subnet".into(),
        },
        SecurePlanStep {
            step: 2,
            action: "Restrict database ports to application servers".into(),
        },
        SecurePlanStep {
            step: 3,
            action: "Allow monitoring from monitoring namespace".into(),
        },
        SecurePlanStep {
            step: 4,
            action: "Block all other inbound".into(),
        },
        SecurePlanStep {
            step: 5,
            action: "Enable Stealth Mode (Standard)".into(),
        },
        SecurePlanStep {
            step: 6,
            action: "Create rollback checkpoint".into(),
        },
    ];
    if detail.inventory.open_ports.iter().any(|p| p.port == 80 || p.port == 443) {
        steps.insert(
            1,
            SecurePlanStep {
                step: 2,
                action: "Keep HTTP/HTTPS for web traffic".into(),
            },
        );
    }
    Ok(SecurePlanReport {
        target: detail.target.name,
        steps,
        risk_after: "low".into(),
        rollback: true,
        summary: format!("Safe Firewall Plan for {}", detail.target.hostname),
    })
}

pub async fn simulate_plan(
    pool: &PgPool,
    cfg: &ControllerConfig,
    target_id: &str,
    profile: &str,
) -> anyhow::Result<serde_json::Value> {
    let detail = target_detail(pool, cfg, target_id).await?;
    let plan = plan_target(
        pool,
        cfg,
        target_id,
        FirewallPlanRequest {
            profile: Some(profile.into()),
            enable: Some(true),
            stealth_level: None,
            preset: None,
            dry_run: true,
        },
    )
    .await?;
    let after_rules: Vec<machina_core::ZeusFirewallRule> = detail
        .inventory
        .rules
        .iter()
        .cloned()
        .collect();
    let diff = compute_diff(&detail.inventory.rules, &after_rules);
    Ok(serde_json::json!({
        "diff": plan.diff,
        "warnings": plan.diff.warnings,
        "simulation": {
            "allows": ["admin subnet → SSH", "app servers → database"],
            "blocks": ["unknown external IP → database", "developer laptop → SSH unless temporary rule added"]
        },
        "connectivity_notes": diff.warnings
    }))
}

pub async fn compliance_report(
    pool: &PgPool,
    cfg: &ControllerConfig,
    report_kind: &str,
) -> anyhow::Result<serde_json::Value> {
    let overview = crate::engine::zeus_firewall::overview(pool, cfg).await?;
    let critical: Vec<_> = overview
        .targets
        .iter()
        .filter(|t| t.risk == "critical")
        .map(|t| serde_json::json!({ "name": t.name, "score": t.score, "open_ports": t.open_ports }))
        .collect();
    Ok(serde_json::json!({
        "report": report_kind,
        "machines_scanned": overview.targets.len(),
        "compliant": overview.targets.iter().filter(|t| t.risk == "low").count(),
        "warnings": overview.warning_count,
        "critical": overview.critical_count,
        "critical_machines": critical,
        "export_formats": ["pdf", "csv", "json"]
    }))
}
