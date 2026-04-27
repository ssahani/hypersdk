//! Standalone HTTP bridge (optional): `GET /bridge/{vm}` → same JSON as machina `/api/v1/vms/.../guacamole-auth`.

use anyhow::Context;
use axum::{
    extract::{Path, State},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use libvirt_guac_bridge::{bridge_from_virsh_domdisplay, GuacamoleBridgeParams};
use std::{net::SocketAddr, sync::Arc};

#[derive(Clone)]
struct AppState {
    params: BridgeParamsOwned,
}

#[derive(Clone)]
struct BridgeParamsOwned {
    secret_hex: String,
    base_url: String,
    public_vnc_host: Option<String>,
    fetch_token: bool,
    username: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let secret_hex = std::env::var("GUAC_SECRET_HEX").context(
        "GUAC_SECRET_HEX must match Guacamole JSON_SECRET_KEY (32 hex chars = 16-byte AES key)",
    )?;
    let state = Arc::new(AppState {
        params: BridgeParamsOwned {
            secret_hex,
            base_url: std::env::var("GUAC_BASE_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:8080/guacamole".to_string()),
            public_vnc_host: std::env::var("PUBLIC_VNC_HOST").ok(),
            fetch_token: std::env::var("GUAC_FETCH_TOKEN")
                .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
                .unwrap_or(true),
            username: std::env::var("GUAC_JSON_USERNAME")
                .unwrap_or_else(|_| "libvirt-user".to_string()),
        },
    });

    let app = Router::new()
        .route("/bridge/{vm}", get(bridge_vm))
        .with_state(state);

    let listen = std::env::var("LISTEN").unwrap_or_else(|_| "0.0.0.0:3000".to_string());
    let addr: SocketAddr = listen
        .parse()
        .with_context(|| format!("invalid LISTEN address: {listen}"))?;
    println!("libvirt-guac-bridge listening on http://{addr}");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

async fn bridge_vm(
    State(state): State<Arc<AppState>>,
    Path(vm): Path<String>,
) -> Result<impl IntoResponse, (axum::http::StatusCode, String)> {
    let p = &state.params;
    let params = GuacamoleBridgeParams {
        secret_hex: &p.secret_hex,
        base_url: &p.base_url,
        public_vnc_host: p.public_vnc_host.as_deref(),
        fetch_token: p.fetch_token,
        username: &p.username,
    };

    let result = bridge_from_virsh_domdisplay(vm, &params).await;

    result.map(Json).map_err(|e| {
        (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            format!("{e:#}"),
        )
    })
}
