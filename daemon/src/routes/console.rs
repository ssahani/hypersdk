use axum::extract::{Path, State};
use axum::http::HeaderMap;
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
    headers: HeaderMap,
    Path(name): Path<String>,
) -> Result<Json<ConsoleInfo>, AppError> {
    let xml = manager.with_conn(|conn| domain::get_vm_xml(conn, &name))?;

    let console_type = virtspawn_core::xml::extract_attr(&xml, "graphics", "type")
        .unwrap_or_else(virtspawn_core::unknown_string);
    let port = virtspawn_core::xml::extract_attr(&xml, "graphics", "port")
        .and_then(|s| s.parse().ok())
        .unwrap_or(-1);
    let ws_port = virtspawn_core::xml::extract_attr(&xml, "graphics", "websocket")
        .and_then(|s| s.parse().ok())
        .unwrap_or(-1);

    // Extract hostname from Host header, fallback to 127.0.0.1
    let listen_host = headers.get("host")
        .and_then(|v| v.to_str().ok())
        .and_then(|h| h.split(':').next())
        .unwrap_or("127.0.0.1")
        .to_string();

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
