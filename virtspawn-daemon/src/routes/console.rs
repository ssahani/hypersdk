use axum::extract::{Path, State};
use axum::routing::get;
use axum::{Json, Router};

use virtspawn_core::libvirt::domain;
use virtspawn_core::LibvirtManager;

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
    Path(name): Path<String>,
) -> Result<Json<ConsoleInfo>, AppError> {
    let xml = manager.with_conn(|conn| domain::get_vm_xml(conn, &name))?;

    let console_type = extract_graphics_type(&xml);
    let port = extract_graphics_port(&xml);
    let ws_port = extract_graphics_attr(&xml, "websocket")
        .and_then(|s| s.parse().ok())
        .unwrap_or(-1);

    Ok(Json(ConsoleInfo {
        name,
        console_type,
        host: "127.0.0.1".to_string(),
        port,
        websocket_port: ws_port,
    }))
}

fn extract_graphics_type(xml: &str) -> String {
    if let Some(start) = xml.find("<graphics ") {
        let after = &xml[start..];
        if let Some(end) = after.find('>') {
            let tag = &after[..end];
            // Try type='...' or type="..."
            for quote in ['\'', '"'] {
                let pattern = format!("type={quote}");
                if let Some(pos) = tag.find(&pattern) {
                    let val_start = pos + pattern.len();
                    if let Some(val_end) = tag[val_start..].find(quote) {
                        return tag[val_start..val_start + val_end].to_string();
                    }
                }
            }
        }
    }
    "unknown".to_string()
}

fn extract_graphics_port(xml: &str) -> i32 {
    extract_graphics_attr(xml, "port")
        .and_then(|s| s.parse().ok())
        .unwrap_or(-1)
}

fn extract_graphics_attr(xml: &str, attr: &str) -> Option<String> {
    let start = xml.find("<graphics ")?;
    let after = &xml[start..];
    let end = after.find('>')?;
    let tag = &after[..end];

    for quote in ['\'', '"'] {
        let pattern = format!("{attr}={quote}");
        if let Some(pos) = tag.find(&pattern) {
            let val_start = pos + pattern.len();
            if let Some(val_end) = tag[val_start..].find(quote) {
                return Some(tag[val_start..val_start + val_end].to_string());
            }
        }
    }
    None
}

pub fn console_routes() -> Router<LibvirtManager> {
    Router::new().route("/vms/console-info/{name}", get(get_console_info))
}
