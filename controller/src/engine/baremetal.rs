// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct BaremetalServer {
    pub id: Uuid,
    pub hostname: String,
    pub bmc_address: String,
    pub bmc_type: String,
    pub state: String,
    pub cpu_cores: i32,
    pub memory_mib: i64,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct RegisterBaremetalBody {
    pub hostname: String,
    pub bmc_address: String,
    #[serde(default = "default_bmc_type")]
    pub bmc_type: String,
    #[serde(default)]
    pub cpu_cores: i32,
    #[serde(default)]
    pub memory_mib: i64,
}

fn default_bmc_type() -> String {
    "redfish".into()
}

#[derive(Debug, Serialize)]
pub struct BaremetalCapacityPlan {
    pub query: String,
    pub servers_needed: i32,
    pub total_cpu_cores: i32,
    pub total_memory_gib: i32,
    pub summary: String,
}

pub async fn list_servers(pool: &PgPool) -> anyhow::Result<Vec<BaremetalServer>> {
    let rows = sqlx::query_as::<_, BaremetalServer>(
        "SELECT id, hostname, bmc_address, bmc_type, state, cpu_cores, memory_mib, created_at
         FROM baremetal_servers ORDER BY hostname",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn register(pool: &PgPool, body: &RegisterBaremetalBody) -> anyhow::Result<BaremetalServer> {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO baremetal_servers (id, hostname, bmc_address, bmc_type, cpu_cores, memory_mib, state)
         VALUES ($1, $2, $3, $4, $5, $6, 'registered')",
    )
    .bind(id)
    .bind(body.hostname.trim())
    .bind(body.bmc_address.trim())
    .bind(&body.bmc_type)
    .bind(body.cpu_cores.max(0))
    .bind(body.memory_mib.max(0))
    .execute(pool)
    .await?;

    sqlx::query_as::<_, BaremetalServer>(
        "SELECT id, hostname, bmc_address, bmc_type, state, cpu_cores, memory_mib, created_at
         FROM baremetal_servers WHERE id = $1",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(Into::into)
}

pub fn plan_capacity(query: &str) -> BaremetalCapacityPlan {
    let ql = query.to_lowercase();
    let engineers = ql
        .split_whitespace()
        .find_map(|w| w.parse::<i32>().ok())
        .unwrap_or(100);
    let servers_needed = ((engineers as f64) / 25.0).ceil() as i32;
    let cores_per = 64;
    let mem_gib_per = 512;
    BaremetalCapacityPlan {
        query: query.into(),
        servers_needed,
        total_cpu_cores: servers_needed * cores_per,
        total_memory_gib: servers_needed * mem_gib_per,
        summary: format!(
            "For ~{engineers} AI engineers: {servers_needed} bare-metal servers ({cores_per} cores, {mem_gib_per} GiB each)"
        ),
    }
}

#[derive(Debug, Deserialize)]
pub struct BmcPowerBody {
    pub action: String,
    #[serde(default)]
    pub dry_run: bool,
}

#[derive(Debug, Serialize)]
pub struct BmcPowerResult {
    pub server_id: String,
    pub hostname: String,
    pub action: String,
    pub previous_state: String,
    pub new_state: String,
    pub dry_run: bool,
    pub summary: String,
}

pub async fn set_power(
    pool: &PgPool,
    id: Uuid,
    body: &BmcPowerBody,
) -> anyhow::Result<BmcPowerResult> {
    let action = body.action.to_lowercase();
    if !matches!(action.as_str(), "on" | "off" | "cycle" | "reset") {
        anyhow::bail!("action must be on, off, cycle, or reset");
    }

    let row: BaremetalServer = sqlx::query_as(
        "SELECT id, hostname, bmc_address, bmc_type, state, cpu_cores, memory_mib, created_at
         FROM baremetal_servers WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| anyhow::anyhow!("server not found"))?;

    let new_state = match action.as_str() {
        "on" => "powered_on",
        "off" => "powered_off",
        "cycle" | "reset" => "rebooting",
        _ => unreachable!(),
    };

    if body.dry_run {
        return Ok(BmcPowerResult {
            server_id: id.to_string(),
            hostname: row.hostname.clone(),
            action: action.clone(),
            previous_state: row.state.clone(),
            new_state: new_state.into(),
            dry_run: true,
            summary: format!(
                "Preview: BMC {} on {} ({}) — would transition {} → {}",
                action, row.hostname, row.bmc_address, row.state, new_state
            ),
        });
    }

    sqlx::query("UPDATE baremetal_servers SET state = $1 WHERE id = $2")
        .bind(new_state)
        .bind(id)
        .execute(pool)
        .await?;

    Ok(BmcPowerResult {
        server_id: id.to_string(),
        hostname: row.hostname,
        action,
        previous_state: row.state,
        new_state: new_state.into(),
        dry_run: false,
        summary: format!("BMC power command applied (preview — no live IPMI/Redfish call)."),
    })
}

#[derive(Debug, Serialize)]
pub struct BaremetalProvisionPlan {
    pub server_id: String,
    pub hostname: String,
    pub steps: Vec<String>,
    pub summary: String,
}

pub async fn provision_preview(pool: &PgPool, id: Uuid) -> anyhow::Result<BaremetalProvisionPlan> {
    let row: BaremetalServer = sqlx::query_as(
        "SELECT id, hostname, bmc_address, bmc_type, state, cpu_cores, memory_mib, created_at
         FROM baremetal_servers WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| anyhow::anyhow!("server not found"))?;

    let steps = vec![
        format!("PXE boot {} via BMC {}", row.hostname, row.bmc_address),
        "Match hardware profile to image catalog (Ubuntu 24.04 / RHEL 9)".into(),
        "Apply cloud-init / ignition for host enrollment".into(),
        "Register host in Machina fleet after first boot".into(),
    ];

    Ok(BaremetalProvisionPlan {
        server_id: id.to_string(),
        hostname: row.hostname.clone(),
        steps,
        summary: format!(
            "PXE provision preview for {} ({}) — live Metal³ workflow on roadmap",
            row.hostname, row.bmc_type
        ),
    })
}
