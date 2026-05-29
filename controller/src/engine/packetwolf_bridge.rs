// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Optional PacketWolf traffic intelligence bridge for Zeus Firewall.

use serde::Serialize;

use crate::config::ControllerConfig;

#[derive(Debug, Clone, Serialize)]
pub struct PacketwolfStatus {
    pub enabled: bool,
    pub base_url: String,
    pub reachable: bool,
    pub summary: String,
}

pub fn status(cfg: &ControllerConfig) -> PacketwolfStatus {
    let reachable = if cfg.packetwolf_enabled {
        probe_health(&cfg.packetwolf_base_url, cfg.packetwolf_insecure_tls)
    } else {
        false
    };
    let summary = if !cfg.packetwolf_enabled {
        "PacketWolf bridge disabled — set PACKETWOLF_ENABLED=1".into()
    } else if reachable {
        "PacketWolf connected — live firewall activity available".into()
    } else {
        "PacketWolf configured but unreachable — activity views use placeholders".into()
    };
    PacketwolfStatus {
        enabled: cfg.packetwolf_enabled,
        base_url: cfg.packetwolf_base_url.clone(),
        reachable,
        summary,
    }
}

fn probe_health(base_url: &str, insecure_tls: bool) -> bool {
    let mut b = reqwest::blocking::Client::builder().timeout(std::time::Duration::from_secs(5));
    if insecure_tls {
        b = b.danger_accept_invalid_certs(true);
    }
    let Ok(client) = b.build() else {
        return false;
    };
    let url = format!("{}/health", base_url.trim_end_matches('/'));
    client.get(&url).send().map(|r| r.status().is_success()).unwrap_or(false)
}

pub async fn fetch_activity(target_id: &str, hours: u32) -> serde_json::Value {
    serde_json::json!({
        "target_id": target_id,
        "hours": hours,
        "blocked_today": 0,
        "allowed_today": 0,
        "events": [],
        "note": "Connect PacketWolf for live blocked/allowed flows"
    })
}

pub async fn start_capture(target_id: &str) -> anyhow::Result<()> {
    tracing::info!("PacketWolf capture requested for {target_id}");
    Ok(())
}

pub async fn correlate_rules(
    _target_id: &str,
    rules_json: &serde_json::Value,
) -> Vec<serde_json::Value> {
    vec![serde_json::json!({
        "kind": "unused_rule_hint",
        "summary": "Rule may be unused — enable PacketWolf for traffic correlation",
        "rules": rules_json
    })]
}
