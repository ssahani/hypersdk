// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use std::path::Path;
use std::time::Duration;

use serde::Serialize;
use sqlx::PgPool;

#[derive(Debug, Serialize)]
pub struct TemplateReadiness {
    pub disk_exists: bool,
    pub host_online: i64,
    pub cloud_init: bool,
    pub ready: bool,
    pub remediation: String,
    pub source_disk: String,
}

pub async fn check_template_readiness(
    pool: &PgPool,
    name: &str,
    version: &str,
) -> anyhow::Result<TemplateReadiness> {
    let row: Option<(String, bool)> = sqlx::query_as(
        "SELECT source_disk, cloud_init FROM templates WHERE name = $1 AND version = $2",
    )
    .bind(name)
    .bind(version)
    .fetch_optional(pool)
    .await?;

    let (source_disk, cloud_init) = row.ok_or_else(|| anyhow::anyhow!("template not found"))?;

    let host_online: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM hosts WHERE state = 'online'")
            .fetch_one(pool)
            .await?;

    let disk_exists = check_disk_exists(pool, &source_disk).await;

    let (ready, remediation) = if host_online == 0 {
        (
            false,
            "No online hosts — enroll a hypervisor and wait for heartbeat.".into(),
        )
    } else if !disk_exists {
        (
            false,
            format!(
                "Disk image missing at {} — upload qcow2 via Content Library or copy to the host images path.",
                source_disk
            ),
        )
    } else {
        (true, "Ready to deploy.".into())
    };

    Ok(TemplateReadiness {
        disk_exists,
        host_online,
        cloud_init,
        ready,
        remediation,
        source_disk,
    })
}

async fn check_disk_exists(pool: &PgPool, path: &str) -> bool {
    if Path::new(path).is_file() {
        return true;
    }

    let hosts: Vec<String> = sqlx::query_scalar(
        "SELECT address FROM hosts WHERE state = 'online' AND address <> '' ORDER BY hostname",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    for addr in hosts {
        if ssh_test_file(&addr, path).await {
            return true;
        }
    }
    false
}

async fn ssh_test_file(address: &str, path: &str) -> bool {
    let target = format!("{address}");
    let output = tokio::time::timeout(
        Duration::from_secs(6),
        tokio::process::Command::new("ssh")
            .args([
                "-o",
                "BatchMode=yes",
                "-o",
                "ConnectTimeout=4",
                "-o",
                "StrictHostKeyChecking=accept-new",
                &target,
                "test",
                "-f",
                path,
            ])
            .output(),
    )
    .await;

    match output {
        Ok(Ok(o)) => o.status.success(),
        _ => false,
    }
}
