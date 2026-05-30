// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use machina_core::gather_cloud_inventory;
use serde::Serialize;
use sqlx::PgPool;

#[derive(Debug, Clone, Serialize)]
pub struct CloudOverview {
    pub inventory: machina_core::CloudFirewallInventory,
    pub last_snapshot_at: Option<String>,
}

pub async fn overview(pool: &PgPool) -> anyhow::Result<CloudOverview> {
    let inv = gather_cloud_inventory();
    let last: Option<(chrono::DateTime<chrono::Utc>,)> = sqlx::query_as(
        "SELECT captured_at FROM firewall_cloud_snapshots ORDER BY captured_at DESC LIMIT 1",
    )
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    let _ = sqlx::query(
        "INSERT INTO firewall_cloud_snapshots (provider, summary, inventory_json)
         VALUES ($1, $2, $3)",
    )
    .bind(inv.provider.as_str())
    .bind(&inv.summary)
    .bind(serde_json::to_value(&inv)?)
    .execute(pool)
    .await;

    Ok(CloudOverview {
        inventory: inv,
        last_snapshot_at: last.map(|(t,)| t.to_rfc3339()),
    })
}
