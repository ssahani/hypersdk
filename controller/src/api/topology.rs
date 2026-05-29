// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use axum::extract::{Path, State};
use axum::Json;
use serde::Serialize;
use uuid::Uuid;

use crate::api::ApiError;
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct TopologyNode {
    pub kind: String,
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TopologyEdge {
    pub from: String,
    pub to: String,
    pub label: String,
}

#[derive(Debug, Serialize)]
pub struct TopologyWarning {
    pub severity: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fix_action: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TopologyGraph {
    pub nodes: Vec<TopologyNode>,
    pub edges: Vec<TopologyEdge>,
    pub warnings: Vec<TopologyWarning>,
}

pub async fn cluster_topology(
    State(state): State<AppState>,
) -> Result<Json<TopologyGraph>, ApiError> {
    Ok(Json(build_topology(&state.pool, None).await?))
}

pub async fn vm_topology(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<TopologyGraph>, ApiError> {
    Ok(Json(build_topology(&state.pool, Some(id)).await?))
}

async fn build_topology(
    pool: &sqlx::PgPool,
    vm_filter: Option<Uuid>,
) -> Result<TopologyGraph, ApiError> {
    let mut nodes = Vec::new();
    let mut edges = Vec::new();
    let mut warnings = Vec::new();

    let cluster_name: String = sqlx::query_scalar("SELECT name FROM clusters LIMIT 1")
        .fetch_one(pool)
        .await
        .unwrap_or_else(|_| "default".into());
    nodes.push(TopologyNode {
        kind: "cluster".into(),
        id: "cluster".into(),
        name: cluster_name,
        state: None,
    });

    let hosts: Vec<(Uuid, String, String)> = sqlx::query_as(
        "SELECT id, hostname, state FROM hosts ORDER BY hostname",
    )
    .fetch_all(pool)
    .await?;

    for (hid, name, st) in &hosts {
        nodes.push(TopologyNode {
            kind: "host".into(),
            id: hid.to_string(),
            name: name.clone(),
            state: Some(st.clone()),
        });
        edges.push(TopologyEdge {
            from: "cluster".into(),
            to: hid.to_string(),
            label: "contains".into(),
        });
    }

    let vms: Vec<(Uuid, String, Option<Uuid>, String, Vec<String>)> = if let Some(vid) = vm_filter {
        sqlx::query_as(
            "SELECT id, name, host_id, observed_state, COALESCE(tags, '{}') FROM vms WHERE id = $1",
        )
        .bind(vid)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as(
            "SELECT id, name, host_id, observed_state, COALESCE(tags, '{}') FROM vms ORDER BY name LIMIT 100",
        )
        .fetch_all(pool)
        .await?
    };

    let host_vm_count: std::collections::HashMap<Uuid, Vec<String>> = {
        let mut m: std::collections::HashMap<Uuid, Vec<String>> = std::collections::HashMap::new();
        for (_, name, host_id, _, _) in &vms {
            if let Some(h) = host_id {
                m.entry(*h).or_default().push(name.clone());
            }
        }
        m
    };

    for (count_host, vm_names) in &host_vm_count {
        if vm_names.len() >= 2 {
            let prod: Vec<_> = vms
                .iter()
                .filter(|(_, n, h, _, tags)| h == &Some(*count_host) && vm_names.contains(n) && tags.iter().any(|t| t == "prod" || t == "production"))
                .collect();
            if prod.len() >= 2 {
                warnings.push(TopologyWarning {
                    severity: "warning".into(),
                    message: format!(
                        "Anti-affinity recommended: {} VMs on same host",
                        prod.iter().map(|(_, n, _, _, _)| n.as_str()).collect::<Vec<_>>().join(", ")
                    ),
                    fix_action: Some("enable_anti_affinity".into()),
                });
            }
        }
    }

    for (vid, name, host_id, st, _) in vms {
        nodes.push(TopologyNode {
            kind: "vm".into(),
            id: vid.to_string(),
            name,
            state: Some(st),
        });
        if let Some(h) = host_id {
            edges.push(TopologyEdge {
                from: h.to_string(),
                to: vid.to_string(),
                label: "runs".into(),
            });
        }
    }

    Ok(TopologyGraph {
        nodes,
        edges,
        warnings,
    })
}
