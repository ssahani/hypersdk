// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// AI operator — guardrailed autonomous secure-machine (Phase 25).

use serde::{Deserialize, Serialize};
use sqlx::PgPool;

use crate::config::ControllerConfig;

use super::inventory::overview;

#[derive(Debug, Clone, Serialize)]
pub struct OperatorThresholds {
    pub max_risk_score: u32,
    pub auto_apply_enabled: bool,
    pub require_approval_above: u32,
    pub budget_guard_usd: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct SecureMachinePreview {
    pub host_id: String,
    pub hostname: String,
    pub current_score: u32,
    pub target_profile: String,
    pub predicted_score: u32,
    pub risk: String,
    pub monthly_exposure_usd: f64,
    pub requires_approval: bool,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct FleetSecurePlan {
    pub previews: Vec<SecureMachinePreview>,
    pub auto_eligible: usize,
    pub approval_required: usize,
    pub summary: String,
}

#[derive(Debug, Deserialize)]
pub struct OperatorExecuteRequest {
    pub host_id: String,
    pub profile: String,
    #[serde(default)]
    pub dry_run: bool,
    #[serde(default)]
    pub force: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct OperatorExecuteResult {
    pub dry_run: bool,
    pub host_id: String,
    pub enqueued: bool,
    pub task_id: Option<String>,
    pub message: String,
}

pub fn thresholds() -> OperatorThresholds {
    OperatorThresholds {
        max_risk_score: 65,
        auto_apply_enabled: false,
        require_approval_above: 45,
        budget_guard_usd: 500.0,
    }
}

pub async fn fleet_secure_preview(
    pool: &PgPool,
    cfg: &ControllerConfig,
) -> anyhow::Result<FleetSecurePlan> {
    let ov = overview(pool, cfg).await?;
    let thresh = thresholds();
    let cfg_finops = crate::config::ControllerConfig::default();
    let exp = super::finops::exposure_rollup(pool, &cfg_finops).await.ok();

    let mut previews = Vec::new();
    for t in ov.targets.iter().filter(|t| t.kind == "host") {
        if t.score >= thresh.max_risk_score {
            continue;
        }
        let exposure = exp
            .as_ref()
            .and_then(|r| r.targets.iter().find(|x| x.target_id == t.id))
            .map(|x| x.exposure_monthly_usd)
            .unwrap_or(0.0);
        let target_profile: String = if t.score < 50 {
            "Emergency".into()
        } else {
            "ProductionServer".into()
        };
        let predicted_score = (t.score + 25).min(95);
        let requires_approval =
            t.score < thresh.require_approval_above || exposure > thresh.budget_guard_usd;
        previews.push(SecureMachinePreview {
            host_id: t.id.clone(),
            hostname: t.hostname.clone(),
            current_score: t.score,
            target_profile: target_profile.clone(),
            predicted_score,
            risk: t.risk.clone(),
            monthly_exposure_usd: exposure,
            requires_approval,
            summary: format!(
                "{} → {} (score {} → ~{})",
                t.hostname, target_profile, t.score, predicted_score
            ),
        });
    }

    let auto_eligible = previews.iter().filter(|p| !p.requires_approval).count();
    let approval_required = previews.len().saturating_sub(auto_eligible);

    Ok(FleetSecurePlan {
        summary: format!(
            "{} host(s) · {} auto-eligible · {} need approval",
            previews.len(),
            auto_eligible,
            approval_required
        ),
        previews,
        auto_eligible,
        approval_required,
    })
}

pub async fn execute_secure(
    pool: &PgPool,
    cfg: &ControllerConfig,
    req: &OperatorExecuteRequest,
    actor: &str,
) -> anyhow::Result<OperatorExecuteResult> {
    let plan = fleet_secure_preview(pool, cfg).await?;
    let preview = plan
        .previews
        .iter()
        .find(|p| p.host_id == req.host_id)
        .ok_or_else(|| anyhow::anyhow!("host not in operator plan"))?;

    if preview.requires_approval && !req.force {
        return Ok(OperatorExecuteResult {
            dry_run: req.dry_run,
            host_id: req.host_id.clone(),
            enqueued: false,
            task_id: None,
            message: "Approval required — use force or approve in Zeus OS".into(),
        });
    }

    if req.dry_run {
        return Ok(OperatorExecuteResult {
            dry_run: true,
            host_id: req.host_id.clone(),
            enqueued: false,
            task_id: None,
            message: format!(
                "Dry-run: would apply {} to {}",
                req.profile, preview.hostname
            ),
        });
    }

    let _ = sqlx::query(
        "INSERT INTO firewall_timeline (target_kind, target_id, kind, summary, detail_json, actor)
         VALUES ('host', $1, 'operator_secure', $2, $3, $4)",
    )
    .bind(
        uuid::Uuid::parse_str(&req.host_id)
            .map(|u| u)
            .unwrap_or_else(|_| uuid::Uuid::nil()),
    )
    .bind(format!("Operator secure {} → {}", preview.hostname, req.profile))
    .bind(serde_json::json!({
        "profile": req.profile,
        "hostname": preview.hostname,
        "stub": true,
    }))
    .bind(actor)
    .execute(pool)
    .await;

    Ok(OperatorExecuteResult {
        dry_run: false,
        host_id: req.host_id.clone(),
        enqueued: false,
        task_id: None,
        message: format!(
            "Operator audit recorded — apply {} to {} via secure-plan (stub enqueue)",
            req.profile, preview.hostname
        ),
    })
}
