// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::PgPool;

#[derive(Debug, Serialize)]
pub struct MemoryIncident {
    pub at: DateTime<Utc>,
    pub kind: String,
    pub summary: String,
    pub actor: String,
    pub lesson: String,
}

#[derive(Debug, Serialize)]
pub struct InfrastructureMemory {
    pub incidents: Vec<MemoryIncident>,
    pub runbook_hints: Vec<String>,
}

pub async fn recall(pool: &PgPool, limit: i64) -> anyhow::Result<InfrastructureMemory> {
    let cap = limit.clamp(1, 50);

    let rows: Vec<(DateTime<Utc>, String, String, Option<serde_json::Value>)> = sqlx::query_as(
        "SELECT created_at, actor, action, detail FROM audit_logs
         WHERE action LIKE '%fail%'
            OR action LIKE 'ai.autopilot%'
            OR action LIKE '%migrate%'
            OR action LIKE '%delete%'
         ORDER BY created_at DESC LIMIT $1",
    )
    .bind(cap)
    .fetch_all(pool)
    .await?;

    let mut incidents = Vec::new();
    for (at, actor, action, detail) in rows {
        let lesson = match action.as_str() {
            a if a.contains("fail") => "Review failed task logs before retry; check agent connectivity.",
            a if a.contains("autopilot") => "Autopilot action audited — verify guardrails before expanding batch size.",
            a if a.contains("migrate") => "Migration events affect placement — check DRS recommendations after.",
            a if a.contains("delete") => "Destructive change recorded — ensure approval workflow was followed.",
            _ => "Historical infrastructure change — correlate with Mission Control timeline.",
        };
        let summary = detail
            .and_then(|d| d.get("message").and_then(|m| m.as_str()).map(String::from))
            .unwrap_or_else(|| action.clone());
        incidents.push(MemoryIncident {
            at,
            kind: action,
            summary,
            actor,
            lesson: lesson.into(),
        });
    }

    let runbook_hints = vec![
        "Storage full → expand pool, prune snapshots, migrate VMs off hot host.".into(),
        "Network change → run Network Lens reachability before closing incident.".into(),
        "VM restart loop → Machina Doctor score + guest tools health.".into(),
    ];

    Ok(InfrastructureMemory {
        incidents,
        runbook_hints,
    })
}
