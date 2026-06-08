// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Finder smart folders + tag index (Phase 39).

use serde::Serialize;
use sqlx::PgPool;

#[derive(Debug, Clone, Serialize)]
pub struct SmartFolder {
    pub id: String,
    pub label: String,
    pub count: i64,
    pub icon: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TagFolder {
    pub tag: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProjectFolder {
    pub project: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct FleetFinderOverview {
    pub summary: String,
    pub smart_folders: Vec<SmartFolder>,
    pub tags: Vec<TagFolder>,
    pub projects: Vec<ProjectFolder>,
}

pub async fn overview(pool: &PgPool) -> anyhow::Result<FleetFinderOverview> {
    let all: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM vms").fetch_one(pool).await?;
    let running: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM vms WHERE observed_state = 'running'",
    )
    .fetch_one(pool)
    .await?;
    let stopped: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM vms WHERE observed_state NOT IN ('running', 'missing')",
    )
    .fetch_one(pool)
    .await?;
    let missing: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM vms WHERE observed_state = 'missing'",
    )
    .fetch_one(pool)
    .await?;
    let discovered: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM vms WHERE managed = FALSE",
    )
    .fetch_one(pool)
    .await?;
    let untagged: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM vms WHERE tags IS NULL OR tags = '{}'",
    )
    .fetch_one(pool)
    .await?;
    let high_cpu: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM vms v JOIN vm_metrics m ON m.vm_id = v.id WHERE m.cpu_percent > 85",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0);
    let unprotected: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*) FROM vms v
        WHERE NOT EXISTS (
            SELECT 1 FROM backup_records b
            WHERE b.vm_id = v.id AND b.status = 'completed'
              AND b.created_at > NOW() - INTERVAL '7 days'
        )
        "#,
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0);
    let ha_enabled: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM vms v JOIN ha_policies hp ON hp.vm_id = v.id WHERE hp.enabled = TRUE",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let tag_rows: Vec<(String, i64)> = sqlx::query_as(
        r#"
        SELECT tag, COUNT(*)::bigint FROM (
            SELECT unnest(tags) AS tag FROM vms WHERE tags IS NOT NULL AND tags != '{}'
        ) t
        GROUP BY tag
        ORDER BY COUNT(*) DESC, tag
        LIMIT 40
        "#,
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let project_rows: Vec<(String, i64)> = sqlx::query_as(
        r#"
        SELECT project, COUNT(*)::bigint FROM vms
        WHERE project IS NOT NULL AND project != ''
        GROUP BY project
        ORDER BY COUNT(*) DESC, project
        LIMIT 20
        "#,
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let smart_folders = vec![
        SmartFolder {
            id: "all".into(),
            label: "All VMs".into(),
            count: all,
            icon: "all".into(),
        },
        SmartFolder {
            id: "running".into(),
            label: "Running".into(),
            count: running,
            icon: "running".into(),
        },
        SmartFolder {
            id: "stopped".into(),
            label: "Stopped".into(),
            count: stopped,
            icon: "stopped".into(),
        },
        SmartFolder {
            id: "discovered".into(),
            label: "Discovered".into(),
            count: discovered,
            icon: "discovered".into(),
        },
        SmartFolder {
            id: "missing".into(),
            label: "Missing".into(),
            count: missing,
            icon: "missing".into(),
        },
        SmartFolder {
            id: "untagged".into(),
            label: "Untagged".into(),
            count: untagged,
            icon: "untagged".into(),
        },
        SmartFolder {
            id: "high_cpu".into(),
            label: "High CPU".into(),
            count: high_cpu,
            icon: "cpu".into(),
        },
        SmartFolder {
            id: "unprotected".into(),
            label: "No backup (7d)".into(),
            count: unprotected,
            icon: "backup".into(),
        },
        SmartFolder {
            id: "ha_enabled".into(),
            label: "HA enabled".into(),
            count: ha_enabled,
            icon: "ha".into(),
        },
    ];

    let tags: Vec<TagFolder> = tag_rows
        .into_iter()
        .map(|(tag, count)| TagFolder { tag, count })
        .collect();

    let projects: Vec<ProjectFolder> = project_rows
        .into_iter()
        .map(|(project, count)| ProjectFolder { project, count })
        .collect();

    Ok(FleetFinderOverview {
        summary: format!(
            "{all} VM(s) · {running} running · {} tag(s) · {} project(s)",
            tags.len(),
            projects.len()
        ),
        smart_folders,
        tags,
        projects,
    })
}
