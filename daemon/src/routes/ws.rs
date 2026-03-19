use std::collections::HashMap;

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, State};
use axum::response::IntoResponse;
use axum::routing::get;
use axum::Router;
use futures_util::{SinkExt, StreamExt};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::time::{interval, Duration};
use tracing::{info, warn};
use virtspawn_core::libvirt::domain;
use virtspawn_core::LibvirtManager;

// ── VM state watch WebSocket ────────────────────────────────────────

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(manager): State<LibvirtManager>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, manager))
}

async fn handle_socket(mut socket: WebSocket, manager: LibvirtManager) {
    info!("WebSocket client connected");

    let mut tick = interval(Duration::from_secs(2));
    let mut prev_states: HashMap<String, String> = HashMap::new();

    loop {
        tick.tick().await;

        let current = manager
            .with_conn(domain::list_vms)
            .unwrap_or_default();

        let mut changes = Vec::new();
        let mut current_names: HashMap<String, String> = HashMap::with_capacity(current.len());

        for vm in &current {
            match prev_states.get(&vm.name) {
                Some(old_state) if *old_state != vm.state => {
                    changes.push(serde_json::json!({
                        "event": "state_change",
                        "name": vm.name,
                        "old_state": old_state,
                        "new_state": vm.state,
                    }));
                }
                None => {
                    changes.push(serde_json::json!({
                        "event": "vm_added",
                        "name": vm.name,
                        "state": vm.state,
                    }));
                }
                _ => {}
            }
            current_names.insert(vm.name.clone(), vm.state.clone());
        }

        for name in prev_states.keys() {
            if !current_names.contains_key(name) {
                changes.push(serde_json::json!({
                    "event": "vm_removed",
                    "name": name,
                }));
            }
        }

        prev_states = current_names;

        let msg = if changes.is_empty() {
            serde_json::json!({ "event": "heartbeat", "vm_count": current.len() })
        } else {
            serde_json::json!({ "event": "changes", "changes": changes })
        };

        if socket
            .send(Message::Text(msg.to_string().into()))
            .await
            .is_err()
        {
            info!("WebSocket client disconnected");
            break;
        }
    }
}

// ── Serial console WebSocket ────────────────────────────────────────

async fn console_handler(
    ws: WebSocketUpgrade,
    Path(name): Path<String>,
    State(manager): State<LibvirtManager>,
) -> impl IntoResponse {
    // Get the PTY path from VM XML
    let pty_path = manager
        .with_conn(|conn| {
            let xml = domain::get_vm_xml(conn, &name)?;
            let path = virtspawn_core::xml::extract_attr(&xml, "console", "tty")
                .or_else(|| {
                    // Look for <source path='...' /> inside <console>
                    for block in virtspawn_core::xml::split_blocks(&xml, "console") {
                        if let Some(p) = virtspawn_core::xml::extract_attr(&block, "source", "path")
                        {
                            return Some(p);
                        }
                    }
                    None
                });
            Ok(path)
        })
        .ok()
        .flatten();

    ws.on_upgrade(move |socket| handle_console(socket, name, pty_path))
}

async fn handle_console(socket: WebSocket, name: String, pty_path: Option<String>) {
    info!("Console WebSocket connected for VM '{}'", name);

    let pty = match pty_path {
        Some(ref p) if std::path::Path::new(p).exists() => p.clone(),
        _ => {
            let (mut sink, _) = socket.split();
            let _ = sink
                .send(Message::Text(
                    format!("\r\nNo console PTY found for VM '{}'. Is it running?\r\n", name)
                        .into(),
                ))
                .await;
            return;
        }
    };

    // Use socat to connect to the PTY — this gives us proper raw I/O
    let child = tokio::process::Command::new("socat")
        .args([
            format!("OPEN:{},rawer", pty).as_str(),
            "STDIO",
        ])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .kill_on_drop(true)
        .spawn();

    let mut child = match child {
        Ok(c) => c,
        Err(e) => {
            warn!("Failed to spawn socat for console: {}", e);
            let (mut sink, _) = socket.split();
            let _ = sink
                .send(Message::Text(
                    format!("\r\nFailed to open console: {}. Is 'socat' installed?\r\n", e).into(),
                ))
                .await;
            return;
        }
    };

    let mut stdout = child.stdout.take().unwrap();
    let mut stdin = child.stdin.take().unwrap();
    let (mut ws_sink, mut ws_stream) = socket.split();

    // stdout → WebSocket
    let mut read_task = tokio::spawn(async move {
        let mut buf = [0u8; 4096];
        loop {
            match stdout.read(&mut buf).await {
                Ok(0) => break,
                Ok(n) => {
                    let text = String::from_utf8_lossy(&buf[..n]).to_string();
                    if ws_sink.send(Message::Text(text.into())).await.is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    });

    // WebSocket → stdin
    let mut write_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_stream.next().await {
            match msg {
                Message::Text(text) => {
                    if stdin.write_all(text.as_bytes()).await.is_err() {
                        break;
                    }
                }
                Message::Binary(data) => {
                    if stdin.write_all(&data).await.is_err() {
                        break;
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    tokio::select! {
        _ = &mut read_task => { write_task.abort(); }
        _ = &mut write_task => { read_task.abort(); }
    }

    let _ = child.kill().await;
    info!("Console WebSocket closed for VM '{}'", name);
}

// ── VNC WebSocket proxy ─────────────────────────────────────────────

async fn vnc_handler(
    ws: WebSocketUpgrade,
    Path(name): Path<String>,
    State(manager): State<LibvirtManager>,
) -> impl IntoResponse {
    let port = manager
        .with_conn(|conn| {
            let xml = domain::get_vm_xml(conn, &name)?;
            let port = virtspawn_core::xml::extract_attr(&xml, "graphics", "port")
                .and_then(|s| s.parse::<u16>().ok())
                .unwrap_or(0);
            Ok(port)
        })
        .unwrap_or(0);

    ws.on_upgrade(move |socket| handle_vnc_proxy(socket, name, port))
}

async fn handle_vnc_proxy(socket: WebSocket, name: String, port: u16) {
    if port == 0 {
        info!("VNC: no port for VM '{}'", name);
        let (mut sink, _) = socket.split();
        let _ = sink.close().await;
        return;
    }

    info!("VNC WebSocket proxy connecting to 127.0.0.1:{} for VM '{}'", port, name);

    let tcp = match tokio::net::TcpStream::connect(format!("127.0.0.1:{}", port)).await {
        Ok(s) => s,
        Err(e) => {
            warn!("Failed to connect to VNC port {}: {}", port, e);
            let (mut sink, _) = socket.split();
            let _ = sink.close().await;
            return;
        }
    };

    info!("VNC TCP connected to port {} for VM '{}'", port, name);

    let (mut tcp_read, mut tcp_write) = tcp.into_split();
    let (mut ws_sink, mut ws_stream) = socket.split();

    // TCP → WebSocket (binary frames)
    let mut read_task = tokio::spawn(async move {
        let mut buf = [0u8; 65536];
        loop {
            match tcp_read.read(&mut buf).await {
                Ok(0) => break,
                Ok(n) => {
                    if ws_sink
                        .send(Message::Binary(buf[..n].to_vec().into()))
                        .await
                        .is_err()
                    {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    });

    // WebSocket → TCP
    let mut write_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_stream.next().await {
            match msg {
                Message::Binary(data) => {
                    if tcp_write.write_all(&data).await.is_err() {
                        break;
                    }
                }
                Message::Text(text) => {
                    if tcp_write.write_all(text.as_bytes()).await.is_err() {
                        break;
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    tokio::select! {
        _ = &mut read_task => { write_task.abort(); }
        _ = &mut write_task => { read_task.abort(); }
    }

    info!("VNC WebSocket proxy closed for VM '{}' port {}", name, port);
}

// ── Routes ──────────────────────────────────────────────────────────

pub fn ws_routes() -> Router<LibvirtManager> {
    Router::new()
        .route("/watch", get(ws_handler))
        .route("/console/{name}", get(console_handler))
        .route("/vnc/{name}", get(vnc_handler))
}
