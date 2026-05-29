// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TwinNode {
    pub kind: String,
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TwinEdge {
    pub from: String,
    pub to: String,
    pub label: String,
}

#[derive(Debug, Serialize)]
pub struct DigitalTwinGraph {
    pub nodes: Vec<TwinNode>,
    pub edges: Vec<TwinEdge>,
    pub node_count: usize,
    pub edge_count: usize,
}

#[derive(Debug, Deserialize)]
pub struct ImpactRequest {
    pub action: String,
    pub target_kind: String,
    pub target_id: String,
}

#[derive(Debug, Serialize)]
pub struct ImpactAnalysis {
    pub action: String,
    pub target: String,
    pub severity: String,
    pub summary: String,
    pub affected_vms: Vec<String>,
    pub affected_applications: Vec<String>,
    pub storage_risks: Vec<String>,
    pub network_notes: Vec<String>,
    pub recommendations: Vec<String>,
}

pub async fn build_graph(pool: &PgPool) -> anyhow::Result<DigitalTwinGraph> {
    let mut nodes = Vec::new();
    let mut edges = Vec::new();

    let cluster_name: String = sqlx::query_scalar("SELECT name FROM clusters LIMIT 1")
        .fetch_one(pool)
        .await
        .unwrap_or_else(|_| "default".into());
    nodes.push(TwinNode {
        kind: "cluster".into(),
        id: "cluster".into(),
        name: cluster_name,
        state: None,
    });

    let hosts: Vec<(Uuid, String, String)> =
        sqlx::query_as("SELECT id, hostname, state FROM hosts ORDER BY hostname")
            .fetch_all(pool)
            .await?;
    for (hid, name, st) in &hosts {
        let id = hid.to_string();
        nodes.push(TwinNode {
            kind: "host".into(),
            id: id.clone(),
            name: name.clone(),
            state: Some(st.clone()),
        });
        edges.push(TwinEdge {
            from: "cluster".into(),
            to: id,
            label: "contains".into(),
        });
    }

    let vms: Vec<(Uuid, String, Option<Uuid>, String)> = sqlx::query_as(
        "SELECT id, name, host_id, observed_state FROM vms ORDER BY name LIMIT 200",
    )
    .fetch_all(pool)
    .await?;
    for (vid, name, host_id, st) in vms {
        let id = vid.to_string();
        nodes.push(TwinNode {
            kind: "vm".into(),
            id: id.clone(),
            name,
            state: Some(st),
        });
        if let Some(h) = host_id {
            edges.push(TwinEdge {
                from: h.to_string(),
                to: id,
                label: "runs".into(),
            });
        }
    }

    let pools: Vec<(Uuid, String)> =
        sqlx::query_as("SELECT id, name FROM storage_pools ORDER BY name")
            .fetch_all(pool)
            .await?;
    for (pid, name) in pools {
        let id = format!("storage-{pid}");
        nodes.push(TwinNode {
            kind: "storage".into(),
            id: id.clone(),
            name,
            state: None,
        });
        edges.push(TwinEdge {
            from: "cluster".into(),
            to: id,
            label: "storage".into(),
        });
    }

    let networks: Vec<(Uuid, String)> =
        sqlx::query_as("SELECT id, name FROM networks ORDER BY name")
            .fetch_all(pool)
            .await?;
    for (nid, name) in networks {
        let id = format!("network-{nid}");
        nodes.push(TwinNode {
            kind: "network".into(),
            id: id.clone(),
            name,
            state: None,
        });
        edges.push(TwinEdge {
            from: "cluster".into(),
            to: id,
            label: "network".into(),
        });
    }

    let edge_count = edges.len();
    let node_count = nodes.len();
    Ok(DigitalTwinGraph {
        nodes,
        edges,
        node_count,
        edge_count,
    })
}

pub async fn analyze_impact(pool: &PgPool, req: &ImpactRequest) -> anyhow::Result<ImpactAnalysis> {
    let action = req.action.to_lowercase();
    let kind = req.target_kind.to_lowercase();

    match (action.as_str(), kind.as_str()) {
        ("shutdown", "host") | ("stop", "host") | ("maintenance", "host") => {
            host_shutdown_impact(pool, &req.target_id).await
        }
        ("shutdown", "vm") | ("stop", "vm") | ("delete", "vm") => {
            vm_shutdown_impact(pool, &req.target_id).await
        }
        _ => Ok(ImpactAnalysis {
            action: req.action.clone(),
            target: format!("{}:{}", req.target_kind, req.target_id),
            severity: "info".into(),
            summary: "Supported actions: shutdown host, shutdown vm.".into(),
            affected_vms: vec![],
            affected_applications: vec![],
            storage_risks: vec![],
            network_notes: vec![],
            recommendations: vec!["Use target_kind host or vm with action shutdown.".into()],
        }),
    }
}

async fn host_shutdown_impact(pool: &PgPool, target: &str) -> anyhow::Result<ImpactAnalysis> {
    let host_id = resolve_host(pool, target).await?;
    let vms: Vec<(Uuid, String, String)> = sqlx::query_as(
        "SELECT id, name, observed_state FROM vms WHERE host_id = $1 ORDER BY name",
    )
    .bind(host_id)
    .fetch_all(pool)
    .await?;

    let vm_names: Vec<String> = vms.iter().map(|(_, n, _)| n.clone()).collect();
    let running: Vec<_> = vms.iter().filter(|(_, _, st)| st == "running").collect();

    let mut affected_apps = Vec::new();
    for (vid, name, _) in &vms {
        let apps: Vec<String> = sqlx::query_scalar(
            "SELECT ag.name FROM application_group_vms agv
             JOIN application_groups ag ON ag.id = agv.group_id
             WHERE agv.vm_id = $1",
        )
        .bind(vid)
        .fetch_all(pool)
        .await
        .unwrap_or_default();
        for app in apps {
            if !affected_apps.contains(&app) {
                affected_apps.push(app);
            }
        }
        let _ = name;
    }

    let host_name: String = sqlx::query_scalar("SELECT hostname FROM hosts WHERE id = $1")
        .bind(host_id)
        .fetch_one(pool)
        .await?;

    let severity = if running.len() >= 3 {
        "critical"
    } else if running.is_empty() {
        "low"
    } else {
        "high"
    };

    let summary = if vm_names.is_empty() {
        format!("Host {host_name} has no VMs — minimal blast radius.")
    } else {
        format!(
            "Shutting down host {host_name} affects {} VM(s) ({} running).",
            vm_names.len(),
            running.len()
        )
    };

    let mut recommendations = Vec::new();
    if !running.is_empty() {
        recommendations.push("Live-migrate running VMs before host maintenance.".into());
    }
    if affected_apps.len() > 1 {
        recommendations.push("Application groups span this host — check anti-affinity.".into());
    }

    Ok(ImpactAnalysis {
        action: "shutdown".into(),
        target: format!("host:{host_name}"),
        severity: severity.into(),
        summary,
        affected_vms: vm_names,
        affected_applications: affected_apps,
        storage_risks: vec!["Shared storage pools remain online; verify multipath.".into()],
        network_notes: vec!["VMs on this host lose compute; bridge networks may show gaps.".into()],
        recommendations,
    })
}

async fn vm_shutdown_impact(pool: &PgPool, target: &str) -> anyhow::Result<ImpactAnalysis> {
    let vm_id = resolve_vm(pool, target).await?;
    let (name, host_id, state): (String, Option<Uuid>, String) = sqlx::query_as(
        "SELECT name, host_id, observed_state FROM vms WHERE id = $1",
    )
    .bind(vm_id)
    .fetch_one(pool)
    .await?;

    let apps: Vec<String> = sqlx::query_scalar(
        "SELECT ag.name FROM application_group_vms agv
         JOIN application_groups ag ON ag.id = agv.group_id
         WHERE agv.vm_id = $1",
    )
    .bind(vm_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let host_name = if let Some(h) = host_id {
        sqlx::query_scalar::<_, String>("SELECT hostname FROM hosts WHERE id = $1")
            .bind(h)
            .fetch_optional(pool)
            .await?
            .unwrap_or_else(|| h.to_string())
    } else {
        "unplaced".into()
    };

    let severity = if apps.iter().any(|a| a.to_lowercase().contains("prod")) {
        "critical"
    } else if state == "running" {
        "high"
    } else {
        "medium"
    };

    Ok(ImpactAnalysis {
        action: "shutdown".into(),
        target: format!("vm:{name}"),
        severity: severity.into(),
        summary: format!("Stopping VM {name} on host {host_name} ({state})."),
        affected_vms: vec![name],
        affected_applications: apps,
        storage_risks: vec![],
        network_notes: vec!["Dependent services may lose connectivity to this VM.".into()],
        recommendations: vec![
            "Create backup before shutdown if data retention required.".into(),
            "Check application group dependencies.".into(),
        ],
    })
}

async fn resolve_host(pool: &PgPool, target: &str) -> anyhow::Result<Uuid> {
    if let Ok(id) = Uuid::parse_str(target) {
        return Ok(id);
    }
    let id: Option<Uuid> = sqlx::query_scalar("SELECT id FROM hosts WHERE hostname = $1")
        .bind(target)
        .fetch_optional(pool)
        .await?;
    id.ok_or_else(|| anyhow::anyhow!("host not found: {target}"))
}

async fn resolve_vm(pool: &PgPool, target: &str) -> anyhow::Result<Uuid> {
    if let Ok(id) = Uuid::parse_str(target) {
        return Ok(id);
    }
    let id: Option<Uuid> = sqlx::query_scalar("SELECT id FROM vms WHERE name = $1")
        .bind(target)
        .fetch_optional(pool)
        .await?;
    id.ok_or_else(|| anyhow::anyhow!("vm not found: {target}"))
}
