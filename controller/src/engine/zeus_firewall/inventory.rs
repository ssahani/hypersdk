// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use machina_core::{
    gather_firewall_inventory, builtin_profiles, FirewallInventory, FirewallPlanRequest,
    FirewallPlanResult, OpenPort,
};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::agent_client;
use crate::config::ControllerConfig;

#[derive(Debug, Clone, Serialize)]
pub struct FirewallTargetSummary {
    pub id: String,
    pub kind: String,
    pub name: String,
    pub hostname: String,
    pub enabled: bool,
    pub backend: String,
    pub profile: Option<String>,
    pub risk: String,
    pub score: u32,
    pub open_ports: usize,
    pub blocked_today: u64,
    pub agent_reachable: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct FirewallOverview {
    pub targets: Vec<FirewallTargetSummary>,
    pub critical_count: usize,
    pub warning_count: usize,
    pub profiles: Vec<String>,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct FirewallTargetDetail {
    pub target: FirewallTargetSummary,
    pub inventory: FirewallInventory,
}

pub async fn overview(pool: &PgPool, cfg: &ControllerConfig) -> anyhow::Result<FirewallOverview> {
    let hosts: Vec<(Uuid, String, String, String)> = sqlx::query_as(
        "SELECT id, hostname, COALESCE(agent_grpc_addr, ''), state FROM hosts ORDER BY hostname",
    )
    .fetch_all(pool)
    .await?;

    let mut targets = Vec::new();
    let mut critical = 0usize;
    let mut warning = 0usize;

    if hosts.is_empty() {
        let inv = gather_firewall_inventory("localhost")?;
        let risk = risk_label(&inv);
        if risk == "critical" {
            critical += 1;
        } else if risk == "warning" {
            warning += 1;
        }
        targets.push(summary_from_inventory(
            "local".into(),
            "host".into(),
            "localhost".into(),
            "localhost".into(),
            &inv,
            true,
        ));
    } else {
        for (id, hostname, agent_addr, state) in hosts {
            let (inv, reachable) = fetch_inventory(cfg, &agent_addr, &hostname, state == "online").await;
            let risk = risk_label(&inv);
            if risk == "critical" {
                critical += 1;
            } else if risk == "warning" {
                warning += 1;
            }
            targets.push(summary_from_inventory(
                id.to_string(),
                "host".into(),
                hostname.clone(),
                hostname,
                &inv,
                reachable,
            ));
        }
    }

    let profiles: Vec<String> = builtin_profiles().into_iter().map(|p| p.name).collect();
    let summary = format!(
        "{} machines scanned · {} critical · {} warnings",
        targets.len(),
        critical,
        warning
    );
    Ok(FirewallOverview {
        targets,
        critical_count: critical,
        warning_count: warning,
        profiles,
        summary,
    })
}

pub async fn target_detail(
    pool: &PgPool,
    cfg: &ControllerConfig,
    target_id: &str,
) -> anyhow::Result<FirewallTargetDetail> {
    if target_id == "local" {
        let inv = gather_firewall_inventory("localhost")?;
        let target = summary_from_inventory(
            "local".into(),
            "host".into(),
            "localhost".into(),
            "localhost".into(),
            &inv,
            true,
        );
        return Ok(FirewallTargetDetail { target, inventory: inv });
    }

    let host_id = Uuid::parse_str(target_id)?;
    let row: (String, String, String) =
        sqlx::query_as("SELECT hostname, COALESCE(agent_grpc_addr, ''), state FROM hosts WHERE id = $1")
            .bind(host_id)
            .fetch_one(pool)
            .await?;
    let (hostname, agent_addr, state) = row;
    let (inv, reachable) = fetch_inventory(cfg, &agent_addr, &hostname, state == "online").await;
    let target = summary_from_inventory(
        target_id.into(),
        "host".into(),
        hostname.clone(),
        hostname,
        &inv,
        reachable,
    );
    Ok(FirewallTargetDetail { target, inventory: inv })
}

pub async fn target_ports(
    pool: &PgPool,
    cfg: &ControllerConfig,
    target_id: &str,
) -> anyhow::Result<Vec<OpenPort>> {
    let detail = target_detail(pool, cfg, target_id).await?;
    Ok(detail.inventory.open_ports)
}

pub async fn target_services(
    pool: &PgPool,
    cfg: &ControllerConfig,
    target_id: &str,
) -> anyhow::Result<Vec<machina_core::firewall::types::AllowedService>> {
    let detail = target_detail(pool, cfg, target_id).await?;
    Ok(detail.inventory.services)
}

pub async fn target_score(
    pool: &PgPool,
    cfg: &ControllerConfig,
    target_id: &str,
) -> anyhow::Result<machina_core::FirewallScore> {
    let detail = target_detail(pool, cfg, target_id).await?;
    Ok(detail.inventory.score)
}

pub async fn plan_target(
    pool: &PgPool,
    cfg: &ControllerConfig,
    target_id: &str,
    req: FirewallPlanRequest,
) -> anyhow::Result<FirewallPlanResult> {
    let hostname = resolve_hostname(pool, cfg, target_id).await?;
    if let Some(addr) = resolve_agent(pool, cfg, target_id).await? {
        return agent_client::apply_firewall_plan(&addr, &req, req.dry_run).await;
    }
    machina_core::compile_profile_plan(&hostname, &req)
        .map_err(|e| anyhow::anyhow!(e.to_string()))
}

pub async fn apply_target(
    pool: &PgPool,
    cfg: &ControllerConfig,
    target_id: &str,
    req: FirewallPlanRequest,
    actor: &str,
) -> anyhow::Result<FirewallPlanResult> {
    let mut apply_req = req;
    apply_req.dry_run = false;
    if let Ok(host_id) = Uuid::parse_str(target_id) {
        if let Ok(detail) = target_detail(pool, cfg, target_id).await {
            let _ = super::checkpoint::save_checkpoint(
                pool,
                "host",
                host_id,
                "pre-apply",
                &detail.inventory,
                Some(actor),
            )
            .await;
        }
    }
    let result = plan_target(pool, cfg, target_id, apply_req.clone()).await?;
    if let Ok(host_id) = Uuid::parse_str(target_id) {
        if let Ok(detail) = target_detail(pool, cfg, target_id).await {
            let _ = super::drift::save_snapshot(pool, "host", host_id, &detail.inventory).await;
        }
        let _ = sqlx::query(
            "INSERT INTO firewall_timeline (target_kind, target_id, kind, summary, detail_json, actor)
             VALUES ('host', $1, 'apply', $2, $3, $4)",
        )
        .bind(host_id)
        .bind(format!("Applied firewall plan ({})", apply_req.profile.as_deref().unwrap_or("custom")))
        .bind(serde_json::json!({ "operations": result.operations }))
        .bind(actor)
        .execute(pool)
        .await;
        let _ = sqlx::query(
            "INSERT INTO audit_logs (id, actor, action, resource_type, resource_id, detail)
             VALUES ($1, $2, 'zeus_firewall.apply', 'host', $3, $4)",
        )
        .bind(Uuid::new_v4())
        .bind(actor)
        .bind(host_id)
        .bind(serde_json::json!({ "profile": apply_req.profile }))
        .execute(pool)
        .await;
    }
    Ok(result)
}

async fn fetch_inventory(
    cfg: &ControllerConfig,
    agent_addr: &str,
    hostname: &str,
    online: bool,
) -> (FirewallInventory, bool) {
    let addr = if agent_addr.is_empty() {
        cfg.default_agent_addr.clone()
    } else {
        agent_addr.to_string()
    };
    if online {
        if let Ok(inv) = agent_client::get_firewall_inventory(&addr).await {
            return (inv, true);
        }
    }
    let inv = gather_firewall_inventory(hostname).unwrap_or_else(|_| empty_inventory(hostname));
    (inv, false)
}

fn empty_inventory(hostname: &str) -> FirewallInventory {
    gather_firewall_inventory(hostname).unwrap_or_else(|_| {
        serde_json::from_value(serde_json::json!({
            "hostname": hostname,
            "posture": { "enabled": false, "backend": "unknown", "stealth_level": "off", "drift_detected": false },
            "rules": [],
            "open_ports": [],
            "services": [],
            "score": { "score": 0, "breakdown": [], "recommendations": [] },
            "profiles_available": []
        }))
        .unwrap()
    })
}

fn summary_from_inventory(
    id: String,
    kind: String,
    name: String,
    hostname: String,
    inv: &FirewallInventory,
    agent_reachable: bool,
) -> FirewallTargetSummary {
    FirewallTargetSummary {
        id,
        kind,
        name,
        hostname,
        enabled: inv.posture.enabled,
        backend: inv.posture.backend.as_str().into(),
        profile: inv.posture.profile.clone(),
        risk: risk_label(inv).into(),
        score: inv.score.score,
        open_ports: inv.open_ports.len(),
        blocked_today: inv.activity.as_ref().map(|a| a.blocked_today).unwrap_or(0),
        agent_reachable,
    }
}

fn risk_label(inv: &FirewallInventory) -> &'static str {
    if inv.open_ports.iter().any(|p| {
        matches!(
            p.risk,
            machina_core::firewall::types::ExposureRisk::Critical
        )
    }) {
        "critical"
    } else if inv.score.score < 70 {
        "warning"
    } else {
        "low"
    }
}

async fn resolve_hostname(pool: &PgPool, cfg: &ControllerConfig, target_id: &str) -> anyhow::Result<String> {
    if target_id == "local" {
        return Ok("localhost".into());
    }
    let host_id = Uuid::parse_str(target_id)?;
    let hostname: String = sqlx::query_scalar("SELECT hostname FROM hosts WHERE id = $1")
        .bind(host_id)
        .fetch_one(pool)
        .await?;
    Ok(hostname)
}

async fn resolve_agent(pool: &PgPool, cfg: &ControllerConfig, target_id: &str) -> anyhow::Result<Option<String>> {
    if target_id == "local" {
        return Ok(Some(cfg.default_agent_addr.clone()));
    }
    let host_id = Uuid::parse_str(target_id)?;
    let addr: String = sqlx::query_scalar("SELECT COALESCE(agent_grpc_addr, '') FROM hosts WHERE id = $1")
        .bind(host_id)
        .fetch_one(pool)
        .await?;
    if addr.is_empty() {
        Ok(None)
    } else {
        Ok(Some(addr))
    }
}

pub async fn apply_profile(
    pool: &PgPool,
    cfg: &ControllerConfig,
    target_id: &str,
    profile: &str,
    actor: &str,
    dry_run: bool,
) -> anyhow::Result<FirewallPlanResult> {
    let req = super::profiles::plan_for_profile(profile, dry_run)?;
    if dry_run {
        plan_target(pool, cfg, target_id, req).await
    } else {
        apply_target(pool, cfg, target_id, req, actor).await
    }
}

pub async fn zeus_firewall_status() -> serde_json::Value {
    serde_json::json!({
        "feature": "zeus-firewall",
        "phase": 1,
        "ai_id": "AI-142",
        "backends": ["firewalld", "ufw", "nftables", "iptables"],
        "ready": true
    })
}
