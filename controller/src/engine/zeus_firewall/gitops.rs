// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct GitOpsExport {
    pub api_version: String,
    pub kind: String,
    pub policies: Vec<GitOpsPolicyDoc>,
    pub exported_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitOpsPolicyDoc {
    pub name: String,
    pub spec_yaml: String,
}

#[derive(Debug, Deserialize)]
pub struct GitOpsSyncRequest {
    pub policies: Vec<GitOpsPolicyDoc>,
    #[serde(default)]
    pub replace: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct GitOpsSyncResult {
    pub upserted: usize,
    pub removed: usize,
    pub sync_id: Uuid,
}

pub async fn export_policies(pool: &PgPool) -> anyhow::Result<GitOpsExport> {
    let rows: Vec<(String, String)> =
        sqlx::query_as("SELECT name, spec_yaml FROM firewall_policies ORDER BY name")
            .fetch_all(pool)
            .await?;

    Ok(GitOpsExport {
        api_version: "zeus.machina/v1".into(),
        kind: "MachineFirewallPolicyBundle".into(),
        policies: rows
            .into_iter()
            .map(|(name, spec_yaml)| GitOpsPolicyDoc { name, spec_yaml })
            .collect(),
        exported_at: chrono::Utc::now().to_rfc3339(),
    })
}

pub async fn sync_policies(
    pool: &PgPool,
    req: GitOpsSyncRequest,
    actor: &str,
) -> anyhow::Result<GitOpsSyncResult> {
    let mut upserted = 0usize;
    let mut removed = 0usize;

    if req.replace {
        let names: Vec<String> = req.policies.iter().map(|p| p.name.clone()).collect();
        if names.is_empty() {
            let r = sqlx::query("DELETE FROM firewall_policies")
                .execute(pool)
                .await?;
            removed = r.rows_affected() as usize;
        } else {
            let r = sqlx::query("DELETE FROM firewall_policies WHERE NOT (name = ANY($1::text[]))")
                .bind(&names)
                .execute(pool)
                .await?;
            removed = r.rows_affected() as usize;
        }
    }

    for policy in &req.policies {
        let existing: Option<Uuid> =
            sqlx::query_scalar("SELECT id FROM firewall_policies WHERE name = $1")
                .bind(&policy.name)
                .fetch_optional(pool)
                .await?;

        if let Some(id) = existing {
            sqlx::query(
                "UPDATE firewall_policies SET spec_yaml = $1, updated_at = NOW() WHERE id = $2",
            )
            .bind(&policy.spec_yaml)
            .bind(id)
            .execute(pool)
            .await?;
        } else {
            sqlx::query("INSERT INTO firewall_policies (id, name, spec_yaml) VALUES ($1, $2, $3)")
                .bind(Uuid::new_v4())
                .bind(&policy.name)
                .bind(&policy.spec_yaml)
                .execute(pool)
                .await?;
        }
        upserted += 1;
    }

    let sync_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO firewall_policy_sync_log (id, direction, policy_count, actor, detail_json)
         VALUES ($1, 'import', $2, $3, $4)",
    )
    .bind(sync_id)
    .bind(upserted as i32)
    .bind(actor)
    .bind(serde_json::json!({ "replace": req.replace, "removed": removed }))
    .execute(pool)
    .await?;

    Ok(GitOpsSyncResult {
        upserted,
        removed,
        sync_id,
    })
}
