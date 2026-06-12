// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Controller-local PacketWolf fabric fallback when production API lacks dev fabric routes.

use std::collections::HashMap;
use std::sync::{LazyLock, RwLock};

use chrono::{DateTime, Utc};
use serde_json::{json, Value};

use crate::config::ControllerConfig;

pub const DEFAULT_TETRAGON_VERSION: &str = "1.7.0";

#[derive(Debug, Clone)]
struct LocalSensor {
    host_id: String,
    status: String,
    tetragon_version: String,
    registered_at: String,
    last_event_at: Option<String>,
}

#[derive(Debug, Clone)]
struct PendingTetragonInstall {
    host_id: String,
    export_url: String,
    queued_at: String,
}

#[derive(Default)]
struct LocalFabricState {
    sensors: HashMap<String, LocalSensor>,
    pending_tetragon: HashMap<String, PendingTetragonInstall>,
}

static LOCAL_FABRIC: LazyLock<RwLock<LocalFabricState>> = LazyLock::new(|| RwLock::new(LocalFabricState::default()));

pub fn load_from_rows(
    rows: Vec<(
        String,
        String,
        String,
        DateTime<Utc>,
        Option<DateTime<Utc>>,
        Option<Value>,
    )>,
) {
    if let Ok(mut state) = LOCAL_FABRIC.write() {
        state.sensors.clear();
        state.pending_tetragon.clear();
        for (host_id, status, tetragon_version, registered_at, last_event_at, pending) in rows {
            state.sensors.insert(
                host_id.clone(),
                LocalSensor {
                    host_id: host_id.clone(),
                    status,
                    tetragon_version,
                    registered_at: registered_at.to_rfc3339(),
                    last_event_at: last_event_at.map(|t| t.to_rfc3339()),
                },
            );
            if let Some(p) = pending {
                let export_url = p
                    .get("export_url")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                if !export_url.is_empty() {
                    state.pending_tetragon.insert(
                        host_id,
                        PendingTetragonInstall {
                            host_id: p
                                .get("host_id")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string(),
                            export_url,
                            queued_at: now_iso(),
                        },
                    );
                }
            }
        }
    }
}

fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

pub fn register_sensor(host_id: &str, tetragon_version: &str) -> Value {
    let sensor = LocalSensor {
        host_id: host_id.to_string(),
        status: "registered".into(),
        tetragon_version: tetragon_version.to_string(),
        registered_at: now_iso(),
        last_event_at: None,
    };
    let out = sensor_to_json(&sensor);
    if let Ok(mut state) = LOCAL_FABRIC.write() {
        state.sensors.insert(host_id.to_string(), sensor);
    }
    json!({
        "ok": true,
        "host_id": host_id,
        "status": "registered",
        "tetragon_version": tetragon_version,
        "source": "machina-controller",
        "sensor": out,
    })
}

fn sensor_to_json(sensor: &LocalSensor) -> Value {
    json!({
        "host_id": sensor.host_id,
        "status": sensor.status,
        "tetragon_version": sensor.tetragon_version,
        "registered_at": sensor.registered_at,
        "last_event_at": sensor.last_event_at,
    })
}

pub fn list_sensors() -> Vec<Value> {
    LOCAL_FABRIC
        .read()
        .ok()
        .map(|state| state.sensors.values().map(sensor_to_json).collect())
        .unwrap_or_default()
}

pub fn queue_tetragon_install(host_id: &str, export_url: &str) -> Value {
    let _ = register_sensor(host_id, DEFAULT_TETRAGON_VERSION);
    let bundle = json!({
        "host_id": host_id,
        "status": "queued",
        "install_unit": "tetragon.service",
        "export_url": export_url,
    });
    if let Ok(mut state) = LOCAL_FABRIC.write() {
        state.pending_tetragon.insert(
            host_id.to_string(),
            PendingTetragonInstall {
                host_id: host_id.to_string(),
                export_url: export_url.to_string(),
                queued_at: now_iso(),
            },
        );
    }
    json!({
        "ok": true,
        "host_id": host_id,
        "source": "machina-controller",
        "bundle": bundle,
    })
}

pub fn agent_bundle(host_id: &str) -> Value {
    let (pending, sensor) = LOCAL_FABRIC
        .read()
        .ok()
        .map(|state| {
            (
                state.pending_tetragon.get(host_id).map(|p| {
                    json!({
                        "host_id": p.host_id,
                        "status": "queued",
                        "install_unit": "tetragon.service",
                        "export_url": p.export_url,
                    })
                }),
                state.sensors.get(host_id).map(sensor_to_json),
            )
        })
        .unwrap_or((None, None));

    json!({
        "host_id": host_id,
        "tetragon_install": pending,
        "tracing_policies": [],
        "removed_policies": [],
        "policy_count": 0,
        "sensor": sensor,
        "source": "machina-controller",
    })
}

pub fn ack_agent_bundle(host_id: &str) -> Value {
    let removed = LOCAL_FABRIC
        .write()
        .ok()
        .and_then(|mut state| state.pending_tetragon.remove(host_id))
        .is_some();
    json!({
        "ok": true,
        "host_id": host_id,
        "acknowledged": removed,
        "source": "machina-controller",
    })
}

pub fn fabric_health(cfg: &ControllerConfig, packetwolf_reachable: bool) -> Value {
    let sensors = list_sensors();
    let healthy = sensors
        .iter()
        .filter(|s| {
            matches!(
                s.get("status").and_then(|v| v.as_str()),
                Some("healthy") | Some("registered")
            )
        })
        .count();
    let mut issues = Vec::new();
    if sensors.is_empty() {
        issues.push(json!({
            "severity": "info",
            "kind": "no_sensors",
            "summary": "No Tetragon sensors enrolled — install sensors on hosts or K8s clusters",
        }));
    }
    issues.push(json!({
        "severity": "info",
        "kind": "fabric_api_fallback",
        "summary": "Production PacketWolf lacks dev fabric routes — sensor registry handled by Machina controller",
    }));
    let status = if packetwolf_reachable {
        if sensors.is_empty() { "degraded" } else { "healthy" }
    } else {
        "offline"
    };
    json!({
        "status": status,
        "sensors_total": sensors.len(),
        "sensors_healthy": healthy,
        "issues": issues,
        "summary": format!(
            "{} sensor(s) · PacketWolf {} · Machina local fabric fallback",
            sensors.len(),
            if packetwolf_reachable { "reachable" } else { "unreachable" }
        ),
        "packetwolf_base_url": cfg.packetwolf_base_url,
        "source": "machina-controller",
    })
}

pub fn sensors_response() -> Value {
    json!({
        "sensors": list_sensors(),
        "source": "machina-controller",
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn local_register_and_bundle_roundtrip() {
        let host = "e5caecb1-f1c0-48c4-8721-276eecb1f747";
        let reg = register_sensor(host, "1.0.0");
        assert_eq!(reg.get("ok").and_then(|v| v.as_bool()), Some(true));
        assert_eq!(list_sensors().len(), 1);

        let export = "https://127.0.0.1:9443/api/v1/ingest";
        let queued = queue_tetragon_install(host, export);
        assert_eq!(queued.get("ok").and_then(|v| v.as_bool()), Some(true));

        let bundle = agent_bundle(host);
        assert!(bundle.get("tetragon_install").is_some());
        assert_eq!(
            bundle
                .pointer("/tetragon_install/export_url")
                .and_then(|v| v.as_str()),
            Some(export)
        );

        let ack = ack_agent_bundle(host);
        assert_eq!(ack.get("acknowledged").and_then(|v| v.as_bool()), Some(true));
        let bundle_after = agent_bundle(host);
        assert!(bundle_after.get("tetragon_install").unwrap().is_null());
    }
}
