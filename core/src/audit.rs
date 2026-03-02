use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

use crate::config::VirtspawnConfig;
use crate::state::AuditEvent;

pub fn audit_log_path() -> PathBuf {
    VirtspawnConfig::config_dir().join("audit.log")
}

pub fn write_audit_event(event: &AuditEvent) {
    let path = audit_log_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    let line = format!(
        "{}\t{}\t{}\t{}\n",
        event.timestamp, event.action, event.target, event.result
    );

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
            let parts: Vec<&str> = line.splitn(4, '\t').collect();
            if parts.len() == 4 {
                Some(AuditEvent {
                    timestamp: parts[0].to_string(),
                    action: parts[1].to_string(),
                    target: parts[2].to_string(),
                    result: parts[3].to_string(),
                })
            } else {
                None
            }
        })
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect()
}
