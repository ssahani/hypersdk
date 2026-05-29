// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Serialize)]
pub struct NetworkExplainResult {
    pub can_reach: bool,
    pub explanation: String,
    pub hops: Vec<String>,
    pub remediation: String,
}

pub async fn explain_reach(
    pool: &PgPool,
    vm_a_name: &str,
    vm_b_name: &str,
    port: Option<i32>,
) -> anyhow::Result<NetworkExplainResult> {
    let a: Option<(Uuid, Option<Uuid>)> = sqlx::query_as(
        "SELECT id, host_id FROM vms WHERE name ILIKE $1 LIMIT 1",
    )
    .bind(vm_a_name)
    .fetch_optional(pool)
    .await?;

    let b: Option<(Uuid, Option<Uuid>)> = sqlx::query_as(
        "SELECT id, host_id FROM vms WHERE name ILIKE $1 LIMIT 1",
    )
    .bind(vm_b_name)
    .fetch_optional(pool)
    .await?;

    let mut hops = Vec::new();
    let port_str = port.map(|p| format!(":{p}")).unwrap_or_default();

    let (Some((a_id, a_host)), Some((b_id, b_host))) = (a, b) else {
        return Ok(NetworkExplainResult {
            can_reach: false,
            explanation: "One or both VMs were not found in inventory.".into(),
            hops,
            remediation: "Verify VM names and sync host inventory.".into(),
        });
    };

    hops.push(format!("{vm_a_name} ({a_id})"));
    if let Some(h) = a_host {
        hops.push(format!("host {h}"));
    }
    hops.push("cluster network".into());
    if let Some(h) = b_host {
        hops.push(format!("host {h}"));
    }
    hops.push(format!("{vm_b_name} ({b_id})"));

    let same_host = a_host.is_some() && a_host == b_host;
    let can_reach = same_host || a_host.is_some();

    let explanation = if same_host {
        format!("{vm_a_name} and {vm_b_name} share the same host — L2 connectivity is likely unless guest firewall blocks{port_str}.")
    } else if can_reach {
        format!("{vm_a_name} and {vm_b_name} are on different hosts — verify bridge/VLAN routing and security groups for TCP{port_str}.")
    } else {
        format!("Cannot determine network path — one VM may lack host assignment.")
    };

    let remediation = if !can_reach {
        "Assign VMs to online hosts and import networks.".into()
    } else {
        format!("Check guest firewalls, network policies, and that port{port_str} is allowed.")
    };

    Ok(NetworkExplainResult {
        can_reach,
        explanation,
        hops,
        remediation,
    })
}
