use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};

use machina_core::{host_virt, LibvirtManager};
use serde_json::json;

async fn health_check(State(manager): State<LibvirtManager>) -> impl IntoResponse {
    let alive = tokio::task::spawn_blocking(move || {
        manager
            .with_conn(|conn| {
                conn.get_hostname()
                    .map_err(|e| machina_core::LibvirtError::Connection(e.to_string()))
            })
            .is_ok()
    })
    .await
    .unwrap_or(false);

    let status = if alive {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    (
        status,
        Json(serde_json::json!({
            "status": if alive { "healthy" } else { "unhealthy" },
            "libvirt": alive,
        })),
    )
}

async fn host_virtualization() -> Json<serde_json::Value> {
    Json(
        serde_json::to_value(host_virt::virtualization_status()).unwrap_or_else(|_| {
            serde_json::json!({ "error": "serialization_failed" })
        }),
    )
}

async fn libvirt_summary(State(manager): State<LibvirtManager>) -> Json<serde_json::Value> {
    Json(manager.api_connection_summary())
}

fn df_use_percent(path: &str) -> Option<u32> {
    let out = std::process::Command::new("df")
        .args(["-P", path])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let line = String::from_utf8_lossy(&out.stdout).lines().nth(1)?.to_string();
    let cols: Vec<&str> = line.split_whitespace().collect();
    if cols.len() < 5 {
        return None;
    }
    cols[4].trim_end_matches('%').parse().ok()
}

async fn host_problems() -> Json<serde_json::Value> {
    let mut items: Vec<serde_json::Value> = Vec::new();
    let v = host_virt::virtualization_status();
    if !v.cpu_virt_supported {
        items.push(json!({
            "id": "cpu_virt",
            "severity": "critical",
            "title": "Hardware virtualization (vmx/svm) not detected",
            "detail": v.hint,
            "doc_url": "https://wiki.archlinux.org/title/KVM",
        }));
    }
    if v.cpu_virt_supported && !v.kvm_device_present {
        items.push(json!({
            "id": "kvm_device",
            "severity": "warning",
            "title": "/dev/kvm missing or not accessible",
            "detail": "Load the kvm module and check permissions for the machina-daemon user.",
            "doc_url": null,
        }));
    }
    if !v.libvirt_system_socket_present && !v.libvirt_session_socket_present {
        items.push(json!({
            "id": "libvirt_socket",
            "severity": "critical",
            "title": "No libvirt daemon socket",
            "detail": v.hint,
            "doc_url": null,
        }));
    }
    if let Some(detail) = host_virt::libvirt_boot_autostart_problem_detail() {
        items.push(json!({
            "id": "libvirt_systemd_boot",
            "severity": "warning",
            "title": "Libvirt may not start automatically on host reboot",
            "detail": detail,
            "doc_url": null,
        }));
    }
    for path in ["/var/lib/libvirt", "/var/lib/machina", "/"] {
        if let Some(pct) = df_use_percent(path) {
            if pct >= 90 {
                let sev = if pct >= 98 { "critical" } else { "warning" };
                items.push(json!({
                    "id": format!("disk_pressure_{}", path.trim_matches('/').replace('/', "_")),
                    "severity": sev,
                    "title": format!("Disk space high on {path}"),
                    "detail": format!("df reports about {pct}% used — free space before provisioning."),
                    "doc_url": null,
                }));
            }
        }
    }
    Json(json!({ "items": items }))
}

pub fn health_routes() -> Router<LibvirtManager> {
    Router::new()
        .route("/health", get(health_check))
        .route("/health/problems", get(host_problems))
        .route("/host/virtualization", get(host_virtualization))
        .route("/libvirt/summary", get(libvirt_summary))
}
