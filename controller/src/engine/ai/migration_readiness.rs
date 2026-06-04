// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::config::ControllerConfig;
use crate::engine::guest_context::{self, GuestAiSnapshot};

use super::llm::{self, CompletionRequest};
use super::migration;
use super::routing::TaskClass;

#[derive(Debug, Deserialize)]
pub struct MigrationReadinessRequest {
    #[serde(default)]
    pub vm_ids: Vec<Uuid>,
    #[serde(default)]
    pub provider: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct VmMigrationReadinessRow {
    pub vm_id: String,
    pub vm_name: String,
    pub readiness_percent: u8,
    pub install_state: String,
    pub os_pretty_name: String,
    pub guest_ip: String,
    pub qga_gaps: Vec<String>,
    pub remediation: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct MigrationReadinessReport {
    pub executive_summary: String,
    pub vm_count: usize,
    pub rows: Vec<VmMigrationReadinessRow>,
    pub prioritized_remediation: Vec<String>,
    pub llm_powered: bool,
}

pub async fn generate(
    pool: &PgPool,
    cfg: &ControllerConfig,
    req: &MigrationReadinessRequest,
) -> anyhow::Result<MigrationReadinessReport> {
    let vm_ids = if req.vm_ids.is_empty() {
        sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM vms WHERE COALESCE(inventory_source, 'libvirt') = 'libvirt' ORDER BY name LIMIT 25",
        )
        .fetch_all(pool)
        .await?
    } else {
        req.vm_ids.clone()
    };

    let provider = req.provider.as_deref().unwrap_or("vmware");
    let snapshots = guest_context::gather_fleet_snapshots(pool, cfg, vm_ids, false).await;
    let mut rows = Vec::new();
    let mut all_remediation = Vec::new();

    for (id, res) in snapshots {
        let snap = match res {
            Ok(s) => s,
            Err(e) => {
                rows.push(VmMigrationReadinessRow {
                    vm_id: id.to_string(),
                    vm_name: id.to_string(),
                    readiness_percent: 40,
                    install_state: "unknown".into(),
                    os_pretty_name: String::new(),
                    guest_ip: String::new(),
                    qga_gaps: vec![e],
                    remediation: vec!["Verify VM is running on libvirt host".into()],
                });
                continue;
            }
        };
        let (row, rem) = row_from_snapshot(&snap, provider);
        all_remediation.extend(rem);
        rows.push(row);
    }

    all_remediation.sort();
    all_remediation.dedup();
    let prioritized_remediation: Vec<String> = all_remediation.into_iter().take(12).collect();

    let executive_summary = if super::settings::llm_enabled(pool).await.unwrap_or(false) && !rows.is_empty()
    {
        let system = "Write a 3-5 sentence executive summary for a KVM migration readiness report. Mention QGA gaps and top remediation priorities.";
        let user = serde_json::to_string(&rows)?;
        if let Ok(Some(text)) = llm::complete(
            pool,
            CompletionRequest {
                task_class: TaskClass::Infrastructure,
                system: system.to_string(),
                user,
                agent_id: None,
                user_id: None,
            },
        )
        .await
        {
            return Ok(MigrationReadinessReport {
                executive_summary: text,
                vm_count: rows.len(),
                rows,
                prioritized_remediation,
                llm_powered: true,
            });
        }
        deterministic_summary(&rows)
    } else {
        deterministic_summary(&rows)
    };

    Ok(MigrationReadinessReport {
        executive_summary,
        vm_count: rows.len(),
        rows,
        prioritized_remediation,
        llm_powered: false,
    })
}

fn row_from_snapshot(s: &GuestAiSnapshot, _provider: &str) -> (VmMigrationReadinessRow, Vec<String>) {
    let os_hint = if s.os_pretty_name.to_lowercase().contains("windows") {
        "windows"
    } else {
        "linux"
    };
    let mut adv = migration::advise_vmware_vm(&s.vm_name, os_hint, false);
    let mut remediation = adv.remediation.clone();
    let mut qga_gaps = Vec::new();
    let mut score = adv.readiness_percent as i32;

    if !s.agent_ping {
        qga_gaps.push("qemu-guest-agent not responding".into());
        remediation.push("Install qemu-guest-agent and enable virtio channel".into());
        score -= 15;
    }
    if s.install_state == "channel_only" {
        qga_gaps.push("Guest agent channel attached but package not running".into());
        score -= 10;
    }
    if let Some(ms) = s.time_delta_ms {
        if ms.abs() > 5000 {
            qga_gaps.push(format!("Time drift {ms} ms"));
            remediation.push("Sync guest time after migration".into());
            score -= 5;
        }
    }
    if s.guest_ip.is_empty() {
        qga_gaps.push("No guest IP discovered".into());
        score -= 10;
    }

    adv.readiness_percent = score.clamp(0, 100) as u8;

    let row = VmMigrationReadinessRow {
        vm_id: s.vm_id.clone(),
        vm_name: s.vm_name.clone(),
        readiness_percent: adv.readiness_percent,
        install_state: s.install_state.clone(),
        os_pretty_name: s.os_pretty_name.clone(),
        guest_ip: s.guest_ip.clone(),
        qga_gaps,
        remediation: remediation.clone(),
    };
    (row, remediation)
}

fn deterministic_summary(rows: &[VmMigrationReadinessRow]) -> String {
    if rows.is_empty() {
        return "No VMs with guest-agent data available for migration readiness.".into();
    }
    let avg: u32 = rows.iter().map(|r| r.readiness_percent as u32).sum::<u32>() / rows.len() as u32;
    let no_qga = rows.iter().filter(|r| !r.qga_gaps.is_empty()).count();
    format!(
        "Migration readiness for {} VM(s): average score {}%. {} VM(s) have QGA or networking gaps — enable guest agent before cutover for accurate inventory and graceful power management.",
        rows.len(),
        avg,
        no_qga
    )
}
