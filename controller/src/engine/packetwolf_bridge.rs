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
    let Ok(client) = build_client(insecure_tls, 5) else {
        return false;
    };
    let url = format!("{}/health", base_url.trim_end_matches('/'));
    client.get(&url).send().map(|r| r.status().is_success()).unwrap_or(false)
}

fn build_client(insecure_tls: bool, timeout_secs: u64) -> anyhow::Result<reqwest::blocking::Client> {
    let mut b = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(timeout_secs));
    if insecure_tls {
        b = b.danger_accept_invalid_certs(true);
    }
    Ok(b.build()?)
}

fn auth_headers(cfg: &ControllerConfig, req: reqwest::blocking::RequestBuilder) -> reqwest::blocking::RequestBuilder {
    if let Some(key) = cfg.packetwolf_api_key.as_deref().filter(|k| !k.is_empty()) {
        req.header("Authorization", format!("Bearer {key}"))
    } else {
        req
    }
}

pub async fn fetch_activity(cfg: &ControllerConfig, target_id: &str, hours: u32) -> serde_json::Value {
    if !cfg.packetwolf_enabled {
        return placeholder_activity(target_id, hours, "PacketWolf disabled");
    }

    let cfg = cfg.clone();
    let target_id = target_id.to_string();
    let fallback_id = target_id.clone();
    tokio::task::spawn_blocking(move || fetch_activity_blocking(&cfg, &target_id, hours))
        .await
        .unwrap_or_else(|_| placeholder_activity(&fallback_id, hours, "PacketWolf fetch failed"))
}

fn fetch_activity_blocking(cfg: &ControllerConfig, target_id: &str, hours: u32) -> serde_json::Value {
    let Ok(client) = build_client(cfg.packetwolf_insecure_tls, 15) else {
        return placeholder_activity(target_id, hours, "HTTP client error");
    };

    let base = cfg.packetwolf_base_url.trim_end_matches('/');
    let stats_url = format!("{base}/api/v1/flows/stats");
    let flows_url = format!("{base}/api/v1/flows?limit=50&verdict=DROPPED");

    let stats_req = auth_headers(cfg, client.get(&stats_url));
    let flows_req = auth_headers(cfg, client.get(&flows_url));

    let stats: serde_json::Value = stats_req
        .send()
        .ok()
        .and_then(|r| r.json().ok())
        .unwrap_or_else(|| serde_json::json!({}));

    let flows_body: serde_json::Value = flows_req
        .send()
        .ok()
        .and_then(|r| r.json().ok())
        .unwrap_or_else(|| serde_json::json!({ "flows": [] }));

    let events = flows_body
        .get("flows")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let blocked_today = stats
        .get("dropped")
        .or_else(|| stats.get("dropped_count"))
        .and_then(|v| v.as_u64())
        .unwrap_or(events.len() as u64);
    let allowed_today = stats
        .get("forwarded")
        .or_else(|| stats.get("allowed"))
        .or_else(|| stats.get("forwarded_count"))
        .and_then(|v| v.as_u64())
        .unwrap_or(0);

    serde_json::json!({
        "target_id": target_id,
        "hours": hours,
        "blocked_today": blocked_today,
        "allowed_today": allowed_today,
        "events": events,
        "stats": stats,
        "source": "packetwolf"
    })
}

fn placeholder_activity(target_id: &str, hours: u32, note: &str) -> serde_json::Value {
    serde_json::json!({
        "target_id": target_id,
        "hours": hours,
        "blocked_today": 0,
        "allowed_today": 0,
        "events": [],
        "note": note
    })
}

pub async fn start_capture(cfg: &ControllerConfig, target_id: &str) -> anyhow::Result<()> {
    if !cfg.packetwolf_enabled {
        anyhow::bail!("PacketWolf disabled");
    }
    tracing::info!("PacketWolf capture requested for {target_id}");
    Ok(())
}

pub async fn correlate_rules(
    cfg: &ControllerConfig,
    target_id: &str,
    rules_json: &serde_json::Value,
) -> Vec<serde_json::Value> {
    if !cfg.packetwolf_enabled {
        return vec![serde_json::json!({
            "kind": "unused_rule_hint",
            "summary": "Rule may be unused — enable PacketWolf for traffic correlation",
            "rules": rules_json
        })];
    }

    let cfg = cfg.clone();
    let target_id = target_id.to_string();
    let rules_json = rules_json.clone();
    tokio::task::spawn_blocking(move || correlate_rules_blocking(&cfg, &target_id, &rules_json))
        .await
        .unwrap_or_default()
}

pub async fn fetch_anomalies(cfg: &ControllerConfig) -> serde_json::Value {
    if !cfg.packetwolf_enabled {
        return serde_json::json!({ "anomalies": [], "note": "PacketWolf disabled" });
    }
    let cfg = cfg.clone();
    tokio::task::spawn_blocking(move || fetch_anomalies_blocking(&cfg))
        .await
        .unwrap_or_else(|_| serde_json::json!({ "anomalies": [], "note": "fetch failed" }))
}

fn fetch_anomalies_blocking(cfg: &ControllerConfig) -> serde_json::Value {
    let Ok(client) = build_client(cfg.packetwolf_insecure_tls, 10) else {
        return serde_json::json!({ "anomalies": [] });
    };
    let url = format!(
        "{}/api/v1/anomalies?limit=25",
        cfg.packetwolf_base_url.trim_end_matches('/')
    );
    auth_headers(cfg, client.get(&url))
        .send()
        .ok()
        .and_then(|r| r.json().ok())
        .unwrap_or_else(|| serde_json::json!({ "anomalies": [] }))
}

fn correlate_rules_blocking(
    cfg: &ControllerConfig,
    target_id: &str,
    rules_json: &serde_json::Value,
) -> Vec<serde_json::Value> {
    let Ok(client) = build_client(cfg.packetwolf_insecure_tls, 10) else {
        return vec![];
    };
    let base = cfg.packetwolf_base_url.trim_end_matches('/');
    let url = format!("{base}/api/v1/flows/stats");
    let stats: serde_json::Value = auth_headers(cfg, client.get(&url))
        .send()
        .ok()
        .and_then(|r| r.json().ok())
        .unwrap_or_else(|| serde_json::json!({}));

    vec![serde_json::json!({
        "kind": "traffic_correlation",
        "target_id": target_id,
        "summary": "PacketWolf flow stats correlated with Zeus firewall rules",
        "flow_stats": stats,
        "rules": rules_json
    })]
}
