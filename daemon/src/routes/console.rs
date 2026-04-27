use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::routing::get;
use axum::{Json, Router};

use machina_core::libvirt::domain;
use machina_core::libvirt::vnc;
use machina_core::xml::{extract_attr, split_blocks};
use machina_core::{LibvirtError, LibvirtManager};

use crate::error::AppError;

#[derive(serde::Serialize)]
struct ConsoleInfo {
    name: String,
    console_type: String,
    host: String,
    port: i32,
    websocket_port: i32,
}

async fn get_console_info(
    State(manager): State<LibvirtManager>,
    headers: HeaderMap,
    Path(name): Path<String>,
) -> Result<Json<ConsoleInfo>, AppError> {
    let name2 = name.clone();
    let manager2 = manager.clone();
    let (xml, vnc_resolved) = tokio::task::spawn_blocking(move || {
        manager2.with_conn(|conn| {
            let xml = domain::get_vm_xml(conn, &name2)?;
            let vnc = vnc::resolve_vnc_tcp_xml(conn, &name2, &xml).ok();
            Ok((xml, vnc))
        })
    })
    .await
    .map_err(|e| AppError::from(LibvirtError::Internal(format!("Task failed: {e}"))))??;

    // Find VNC graphics first, then fall back to any graphics type
    let mut console_type = machina_core::unknown_string();
    let mut port: i32 = -1;
    let mut ws_port: i32 = -1;

    for block in split_blocks(&xml, "graphics") {
        let gtype = extract_attr(&block, "graphics", "type").unwrap_or_default();
        let gport = extract_attr(&block, "graphics", "port")
            .and_then(|s| s.parse().ok())
            .unwrap_or(-1);
        let gwsport = extract_attr(&block, "graphics", "websocket")
            .and_then(|s| s.parse().ok())
            .unwrap_or(-1);

        if gtype == "vnc" {
            // Prefer VNC
            console_type = gtype;
            port = gport;
            ws_port = gwsport;
            break;
        }
        // Store first graphics entry as fallback
        if console_type == "unknown" {
            console_type = gtype;
            port = gport;
            ws_port = gwsport;
        }
    }

    // hyper2kvm-style: real TCP port/host from XML or `virsh vncdisplay` (fixes autoport -1).
    let mut listen_host = headers
        .get("host")
        .and_then(|v| v.to_str().ok())
        .and_then(|h| h.split(':').next())
        .filter(|h| {
            h.chars()
                .all(|c| c.is_alphanumeric() || c == '.' || c == '-')
        })
        .unwrap_or("127.0.0.1")
        .to_string();

    if console_type == "vnc" {
        if let Some((h, p)) = vnc_resolved {
            listen_host = h;
            port = i32::from(p);
        }
    }

    Ok(Json(ConsoleInfo {
        name,
        console_type,
        host: listen_host,
        port,
        websocket_port: ws_port,
    }))
}

pub fn console_routes() -> Router<LibvirtManager> {
    Router::new().route("/vms/console-info/{name}", get(get_console_info))
}
