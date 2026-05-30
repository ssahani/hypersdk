// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Host Linux OS surfaces — proxy agent RPC for enrolled hypervisors (Phase 33).

use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::agent_client;
use crate::config::ControllerConfig;

pub async fn resolve_agent_addr(
    pool: &PgPool,
    cfg: &ControllerConfig,
    host_id: Uuid,
) -> anyhow::Result<(String, String)> {
    let row: (String, String) = sqlx::query_as(
        "SELECT hostname, COALESCE(NULLIF(agent_grpc_addr, ''), '') FROM hosts WHERE id = $1",
    )
    .bind(host_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| anyhow::anyhow!("host not found"))?;
    let addr = if row.1.is_empty() {
        cfg.default_agent_addr.clone()
    } else {
        row.1
    };
    if addr.is_empty() {
        anyhow::bail!("no agent address for host {}", row.0);
    }
    Ok((row.0, addr))
}

pub async fn linux_observability(
    pool: &PgPool,
    cfg: &ControllerConfig,
    host_id: Uuid,
) -> anyhow::Result<serde_json::Value> {
    let (_, addr) = resolve_agent_addr(pool, cfg, host_id).await?;
    agent_client::get_linux_observability(&addr).await
}

pub async fn network_diagnostics(
    pool: &PgPool,
    cfg: &ControllerConfig,
    host_id: Uuid,
) -> anyhow::Result<serde_json::Value> {
    let (hostname, addr) = match resolve_agent_addr(pool, cfg, host_id).await {
        Ok(v) => v,
        Err(e) => {
            return Ok(serde_json::json!({
                "agent_reachable": false,
                "hostname": hostname_from_pool(pool, host_id).await.unwrap_or_default(),
                "summary": format!("Network diagnostics unavailable: {e}"),
                "interfaces": [],
                "routes": [],
            }));
        }
    };
    match agent_client::get_systemd_network_diagnostics(&addr).await {
        Ok(v) => Ok(v),
        Err(e) => {
            tracing::warn!("network diagnostics for {hostname} via {addr}: {e}");
            Ok(serde_json::json!({
                "agent_reachable": false,
                "hostname": hostname,
                "summary": format!("Network diagnostics unavailable: {e}"),
                "interfaces": [],
                "routes": [],
            }))
        }
    }
}

async fn hostname_from_pool(pool: &PgPool, host_id: Uuid) -> anyhow::Result<String> {
    sqlx::query_scalar("SELECT hostname FROM hosts WHERE id = $1")
        .bind(host_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| anyhow::anyhow!("host not found"))
}

pub async fn linux_audit(
    pool: &PgPool,
    cfg: &ControllerConfig,
    host_id: Uuid,
) -> anyhow::Result<serde_json::Value> {
    let (_, addr) = resolve_agent_addr(pool, cfg, host_id).await?;
    agent_client::get_linux_audit(&addr).await
}

pub async fn linux_package_updates(
    pool: &PgPool,
    cfg: &ControllerConfig,
    host_id: Uuid,
) -> anyhow::Result<serde_json::Value> {
    let (_, addr) = resolve_agent_addr(pool, cfg, host_id).await?;
    agent_client::get_linux_package_updates(&addr).await
}

#[derive(Debug, serde::Serialize)]
pub struct VmGuestHealthReport {
    pub vm_id: String,
    pub vm_name: String,
    pub agent_reachable: bool,
    pub healthy: bool,
    pub os_pretty_name: String,
    pub guest_ip: String,
    pub guest_hostname: String,
    pub issues: Vec<String>,
    pub summary: String,
}

pub async fn vm_guest_health(
    pool: &PgPool,
    cfg: &ControllerConfig,
    vm_id: Uuid,
) -> anyhow::Result<VmGuestHealthReport> {
    let row: (String, Uuid) =
        sqlx::query_as("SELECT name, host_id FROM vms WHERE id = $1")
            .bind(vm_id)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| anyhow::anyhow!("vm not found"))?;
    let (vm_name, host_id) = row;
    let (_, addr) = resolve_agent_addr(pool, cfg, host_id).await?;
    let mut client = agent_client::connect(&addr).await?;
    let gh = agent_client::get_guest_health(&mut client, &vm_name).await?;
    let summary = if gh.healthy {
        format!("Guest healthy · {}", gh.os_pretty_name)
    } else if !gh.agent_reachable {
        "QEMU guest agent unreachable".into()
    } else {
        format!("{} issue(s) reported", gh.issues.len())
    };
    Ok(VmGuestHealthReport {
        vm_id: vm_id.to_string(),
        vm_name,
        agent_reachable: gh.agent_reachable,
        healthy: gh.healthy,
        os_pretty_name: gh.os_pretty_name,
        guest_ip: gh.guest_ip,
        guest_hostname: gh.guest_hostname,
        issues: gh.issues,
        summary,
    })
}

#[derive(Debug, serde::Serialize)]
pub struct VmGuestServiceRow {
    pub name: String,
    pub status: String,
    pub detail: String,
}

#[derive(Debug, serde::Serialize)]
pub struct VmGuestServicesReport {
    pub vm_id: String,
    pub vm_name: String,
    pub agent_reachable: bool,
    pub services: Vec<VmGuestServiceRow>,
    pub summary: String,
}

pub async fn vm_guest_services(
    pool: &PgPool,
    cfg: &ControllerConfig,
    vm_id: Uuid,
) -> anyhow::Result<VmGuestServicesReport> {
    let health = vm_guest_health(pool, cfg, vm_id).await?;
    let ports = crate::engine::zeus_firewall::guest_ports::vm_guest_ports(
        pool,
        cfg,
        &vm_id.to_string(),
    )
    .await
    .ok();
    let mut services = Vec::new();
    if health.agent_reachable {
        services.push(VmGuestServiceRow {
            name: "qemu-guest-agent".into(),
            status: if health.healthy { "running" } else { "degraded" }.into(),
            detail: health.os_pretty_name.clone(),
        });
    }
    if let Some(ref p) = ports {
        for port in p.ports.iter().take(12) {
            services.push(VmGuestServiceRow {
                name: port
                    .process
                    .clone()
                    .unwrap_or_else(|| format!("{}:{}", port.protocol, port.port)),
                status: "listening".into(),
                detail: format!("{} · {}", port.protocol, port.port),
            });
        }
    }
    for issue in &health.issues {
        services.push(VmGuestServiceRow {
            name: "issue".into(),
            status: "warn".into(),
            detail: issue.clone(),
        });
    }
    Ok(VmGuestServicesReport {
        vm_id: health.vm_id,
        vm_name: health.vm_name,
        agent_reachable: health.agent_reachable,
        summary: format!("{} service row(s) from guest agent", services.len()),
        services,
    })
}

#[derive(Debug, Clone, Serialize)]
pub struct OsDiagnoseAction {
    pub label: String,
    pub action: String,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct HostOsDiagnoseReport {
    pub host_id: String,
    pub hostname: String,
    pub query: String,
    pub summary: String,
    pub hypotheses: Vec<super::ai::knowledge_diagnose::DiagnoseHypothesis>,
    pub fix_actions: Vec<OsDiagnoseAction>,
}

pub async fn diagnose_host(
    pool: &PgPool,
    cfg: &ControllerConfig,
    host_id: Uuid,
    query: Option<&str>,
) -> anyhow::Result<HostOsDiagnoseReport> {
    let hostname: String = sqlx::query_scalar("SELECT hostname FROM hosts WHERE id = $1")
        .bind(host_id)
        .fetch_one(pool)
        .await?;
    let q = query.unwrap_or("why is this host under pressure").to_string();
    let mut diag = super::ai::knowledge_diagnose::diagnose(pool, &format!("{q} {hostname}")).await?;
    let mut fix_actions = vec![
        OsDiagnoseAction {
            label: "Sync host inventory".into(),
            action: "host.sync".into(),
            detail: format!("POST /api/v1/hosts/{host_id}/sync"),
        },
        OsDiagnoseAction {
            label: "Validate join checklist".into(),
            action: "host.validate".into(),
            detail: format!("GET /api/v1/hosts/{host_id}/validate"),
        },
        OsDiagnoseAction {
            label: "Open Machine Security".into(),
            action: "firewall.open".into(),
            detail: format!("/platform/zeus/security/firewall/{host_id}"),
        },
    ];
    if let Ok(obs) = linux_observability(pool, cfg, host_id).await {
        let io = obs
            .get("pressure")
            .and_then(|p| p.get("io"))
            .and_then(|i| i.get("some"))
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        if io > 0.3 {
            diag.hypotheses.push(super::ai::knowledge_diagnose::DiagnoseHypothesis {
                title: "IO pressure on hypervisor".into(),
                confidence: 0.82,
                evidence: format!("PSI io some {:.0}%", io * 100.0),
                action: "Check storage pool latency and running VM disk IOPS.".into(),
            });
            fix_actions.push(OsDiagnoseAction {
                label: "Review storage pools".into(),
                action: "nav.storage".into(),
                detail: "/platform/storage".into(),
            });
        }
    }
    Ok(HostOsDiagnoseReport {
        host_id: host_id.to_string(),
        hostname: hostname.clone(),
        query: q.clone(),
        summary: format!("{} — {}", hostname, diag.summary),
        hypotheses: diag.hypotheses,
        fix_actions,
    })
}

#[derive(Debug, Clone, Serialize)]
pub struct VmOsDiagnoseReport {
    pub vm_id: String,
    pub vm_name: String,
    pub query: String,
    pub summary: String,
    pub guest_healthy: bool,
    pub hypotheses: Vec<super::ai::knowledge_diagnose::DiagnoseHypothesis>,
    pub fix_actions: Vec<OsDiagnoseAction>,
}

pub async fn diagnose_vm(
    pool: &PgPool,
    cfg: &ControllerConfig,
    vm_id: Uuid,
    query: Option<&str>,
) -> anyhow::Result<VmOsDiagnoseReport> {
    let health = vm_guest_health(pool, cfg, vm_id).await?;
    let q = query.unwrap_or("guest health and exposed ports").to_string();
    let mut diag = super::ai::knowledge_diagnose::diagnose(pool, &format!("{} {}", q, health.vm_name)).await?;
    if !health.agent_reachable {
        diag.hypotheses.insert(
            0,
            super::ai::knowledge_diagnose::DiagnoseHypothesis {
                title: "QEMU guest agent offline".into(),
                confidence: 0.9,
                evidence: health.summary.clone(),
                action: "Install Guest Tools and ensure VM is running.".into(),
            },
        );
    }
    Ok(VmOsDiagnoseReport {
        vm_id: vm_id.to_string(),
        vm_name: health.vm_name.clone(),
        query: q,
        summary: health.summary.clone(),
        guest_healthy: health.healthy,
        hypotheses: diag.hypotheses,
        fix_actions: vec![
            OsDiagnoseAction {
                label: "Install Guest Tools".into(),
                action: "vm.guest_tools".into(),
                detail: format!("POST /api/v1/vms/{vm_id}/guest-tools/install"),
            },
            OsDiagnoseAction {
                label: "Run VM health check".into(),
                action: "vm.health_check".into(),
                detail: format!("POST /api/v1/vms/{vm_id}/health-check"),
            },
        ],
    })
}
