use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

use crate::state::AuditEvent;

pub fn audit_log_path() -> PathBuf {
    PathBuf::from("/var/lib/machina/audit.log")
}

pub fn write_audit_event(event: &AuditEvent) {
    let path = audit_log_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    let line = if event.actor.is_empty() {
        format!(
            "{}\t{}\t{}\t{}\n",
            event.timestamp, event.action, event.target, event.result
        )
    } else {
        format!(
            "{}\t{}\t{}\t{}\t{}\n",
            event.timestamp, event.action, event.target, event.result, event.actor
        )
    };

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&path) {
        let _ = file.write_all(line.as_bytes());
    }
}

pub fn load_audit_events(max: usize) -> Vec<AuditEvent> {
    let path = audit_log_path();
    let content = match fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    content
        .lines()
        .rev()
        .take(max)
        .filter_map(|line| {
            let parts: Vec<&str> = line.split('\t').collect();
            match parts.len() {
                4 => Some(AuditEvent {
                    timestamp: parts[0].to_string(),
                    action: parts[1].to_string(),
                    target: parts[2].to_string(),
                    result: parts[3].to_string(),
                    actor: String::new(),
                }),
                n if n >= 5 => Some(AuditEvent {
                    timestamp: parts[0].to_string(),
                    action: parts[1].to_string(),
                    target: parts[2].to_string(),
                    result: parts[3].to_string(),
                    actor: parts[4].to_string(),
                }),
                _ => {
                    tracing::debug!("Skipping malformed audit line: {}", line);
                    None
                }
            }
        })
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect()
}

/// Full audit log as newline-delimited JSON (SIEM / archival export).
pub fn export_audit_ndjson(max: usize) -> String {
    let events = load_audit_events(max);
    events
        .into_iter()
        .filter_map(|e| serde_json::to_string(&e).ok())
        .collect::<Vec<_>>()
        .join("\n")
        + "\n"
}
