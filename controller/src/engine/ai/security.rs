// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use serde::Serialize;
use sqlx::PgPool;

#[derive(Debug, Serialize)]
pub struct SecurityFinding {
    pub id: String,
    pub severity: String,
    pub title: String,
    pub detail: String,
    pub remediation: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub object_ref: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct SecurityReport {
    pub risk_level: String,
    pub findings: Vec<SecurityFinding>,
}

pub async fn scan(pool: &PgPool) -> anyhow::Result<SecurityReport> {
    let mut findings = Vec::new();

    let no_backup: Vec<(uuid::Uuid, String)> = sqlx::query_as(
        "SELECT v.id, v.name FROM vms v
         WHERE COALESCE(v.managed, TRUE) = TRUE
           AND ('prod' = ANY(COALESCE(v.tags, '{}')) OR 'production' = ANY(COALESCE(v.tags, '{}')))
           AND NOT EXISTS (SELECT 1 FROM backup_records b WHERE b.vm_id = v.id AND b.status = 'completed')
         LIMIT 20",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    for (id, name) in no_backup {
        findings.push(SecurityFinding {
            id: format!("no-backup-{id}"),
            severity: "high".into(),
            title: format!("Production VM '{name}' has no backup"),
            detail: "Backup compliance gap for production workload.".into(),
            remediation: "Queue backup from VM Doctor or Recommendations.".into(),
            object_ref: Some(serde_json::json!({ "vm_id": id.to_string() })),
        });
    }

    let no_guest: Vec<(uuid::Uuid, String)> = sqlx::query_as(
        "SELECT id, name FROM vms WHERE observed_state = 'running'
         AND guest_tools_status IN ('unknown', 'not_installed') LIMIT 15",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    for (id, name) in no_guest {
        findings.push(SecurityFinding {
            id: format!("no-guest-{id}"),
            severity: "medium".into(),
            title: format!("Guest tools missing on '{name}'"),
            detail: "Monitoring and graceful shutdown may be impaired.".into(),
            remediation: "Install guest tools from VM detail.".into(),
            object_ref: Some(serde_json::json!({ "vm_id": id.to_string() })),
        });
    }

    let offline_hosts: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM hosts WHERE state = 'offline'")
            .fetch_one(pool)
            .await
            .unwrap_or(0);
    if offline_hosts > 0 {
        findings.push(SecurityFinding {
            id: "offline-hosts".into(),
            severity: "high".into(),
            title: format!("{offline_hosts} host(s) offline"),
            detail: "Cluster resilience reduced.".into(),
            remediation: "Sync hosts and restart agents.".into(),
            object_ref: None,
        });
    }

    let risk_level = if findings.iter().any(|f| f.severity == "high") {
        "high"
    } else if findings.is_empty() {
        "low"
    } else {
        "medium"
    };

    Ok(SecurityReport {
        risk_level: risk_level.into(),
        findings,
    })
}

pub async fn explain_event(
    event: &serde_json::Value,
    host_id: Option<&str>,
) -> anyhow::Result<serde_json::Value> {
    let kind = event.get("kind").and_then(|v| v.as_str()).unwrap_or("security");
    let summary = event
        .get("summary")
        .and_then(|v| v.as_str())
        .unwrap_or("Security event");
    let severity = event.get("severity").and_then(|v| v.as_str()).unwrap_or("info");
    let risk = match severity {
        "critical" => "Critical — investigate immediately",
        "high" => "High — likely requires operator review",
        "medium" => "Medium — monitor and correlate",
        _ => "Low — likely routine activity",
    };
    Ok(serde_json::json!({
        "host_id": host_id,
        "kind": kind,
        "summary": summary,
        "explanation": format!("Event type '{kind}': {summary}. {risk}."),
        "risk": risk,
        "recommendation": "Review timeline for related events; use attack reconstruction if severity is high."
    }))
}

pub fn attack_reconstruct_sync(timeline: &serde_json::Value) -> serde_json::Value {
    let events = timeline
        .get("events")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    let mut chain: Vec<String> = Vec::new();
    for (i, ev) in events.iter().take(8).enumerate() {
        let s = ev
            .get("summary")
            .and_then(|v| v.as_str())
            .unwrap_or("event");
        chain.push(format!("{}. {}", i + 1, s));
    }
    serde_json::json!({
        "attack_chain": chain,
        "summary": if chain.is_empty() {
            "No events in window — unable to reconstruct chain.".into()
        } else {
            format!("Reconstructed {} step(s) from security timeline.", chain.len())
        }
    })
}

pub fn translate_nl_search(query: &str) -> String {
    let q = query.to_lowercase();
    if q.contains("port 8080") || q.contains("8080") {
        return "8080 network_connect".into();
    }
    if q.contains("sudo") {
        return "sudo privilege".into();
    }
    if q.contains("ssh") {
        return "sshd ssh".into();
    }
    if q.contains("curl") {
        return "curl".into();
    }
    if q.contains("russia") || q.contains("russian") {
        return "suspicious dns .ru".into();
    }
    query.to_string()
}
