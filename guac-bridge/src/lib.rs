// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

//! Apache Guacamole **encrypted JSON authentication** helpers: VNC endpoint → signed/encrypted `data`
//! blob for `/api/tokens`. Used by the optional `libvirt-guac-bridge` binary and `machina-daemon`.

use anyhow::{anyhow, bail, Context, Result};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use chrono::{Duration, Utc};
use openssl::{
    hash::MessageDigest,
    pkey::PKey,
    sign::Signer,
    symm::{Cipher, Crypter, Mode},
};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::process::Command;

/// JSON returned to API clients (daemon or standalone bridge).
#[derive(Debug, Serialize)]
pub struct BridgeResponse {
    pub vm: String,
    pub protocol: String,
    pub target_host: String,
    pub target_port: u16,
    pub guac_data: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GuacTokenResponse {
    #[serde(rename = "authToken")]
    auth_token: Option<String>,
}

/// Inputs for building the encrypted JSON (same secret as Guacamole `JSON_SECRET_KEY`).
pub struct GuacamoleBridgeParams<'a> {
    pub secret_hex: &'a str,
    pub base_url: &'a str,
    /// When VNC listen is loopback, replace with this for `guacd` reachability.
    pub public_vnc_host: Option<&'a str>,
    /// POST `data` to `{base_url}/api/tokens` and fill `token` when successful.
    pub fetch_token: bool,
    /// `username` field inside the cleartext JSON auth document.
    pub username: &'a str,
}

#[derive(Debug)]
pub struct GuacConnection {
    pub name: String,
    pub protocol: String,
    pub target_host: String,
    pub target_port: u16,
    pub parameters: BTreeMap<String, String>,
}

#[derive(Debug)]
pub enum DisplayEndpoint {
    Vnc { host: String, port: u16 },
    Spice { host: String, port: u16 },
}

/// Run `virsh domdisplay <vm>` and parse `vnc://` / `spice://`.
pub fn get_libvirt_display(vm: &str) -> Result<DisplayEndpoint> {
    let output = Command::new("virsh")
        .args(["domdisplay", vm])
        .output()
        .with_context(|| format!("failed to run virsh domdisplay {vm}"))?;

    if !output.status.success() {
        bail!(
            "virsh domdisplay failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    let raw = String::from_utf8(output.stdout)?.trim().to_string();
    if raw.is_empty() {
        bail!("empty display URI returned for VM {vm}");
    }

    parse_display_uri(&raw)
}

pub fn parse_display_uri(uri: &str) -> Result<DisplayEndpoint> {
    let parsed = url::Url::parse(uri).with_context(|| format!("invalid display URI: {uri}"))?;
    let host = parsed
        .host_str()
        .ok_or_else(|| anyhow!("missing host in display URI: {uri}"))?
        .to_string();
    let port = parsed
        .port()
        .ok_or_else(|| anyhow!("missing port in display URI: {uri}"))?;

    match parsed.scheme() {
        "vnc" => Ok(DisplayEndpoint::Vnc { host, port }),
        "spice" => Ok(DisplayEndpoint::Spice { host, port }),
        other => bail!("unsupported display scheme: {other}"),
    }
}

pub fn guac_connection_from_endpoint(
    vm: &str,
    endpoint: DisplayEndpoint,
    public_host_override: Option<&str>,
) -> Result<GuacConnection> {
    match endpoint {
        DisplayEndpoint::Vnc { host, port } => {
            let target_host = normalize_host(host, public_host_override);

            let mut parameters = BTreeMap::new();
            parameters.insert("hostname".into(), target_host.clone());
            parameters.insert("port".into(), port.to_string());
            parameters.insert("read-only".into(), "false".into());
            parameters.insert("swap-red-blue".into(), "false".into());
            parameters.insert("cursor".into(), "local".into());

            Ok(GuacConnection {
                name: format!("libvirt:{vm}"),
                protocol: "vnc".into(),
                target_host,
                target_port: port,
                parameters,
            })
        }
        DisplayEndpoint::Spice { host, port } => {
            bail!(
                "SPICE display (spice://{host}:{port}): use VNC or guest RDP for Guacamole; JSON auth has no native SPICE"
            );
        }
    }
}

/// Build connection from resolved TCP `host:port` (e.g. from libvirt `vnc::resolve_vnc_tcp`).
pub fn guac_connection_from_vnc_tcp(
    vm: &str,
    host: String,
    port: u16,
    public_host_override: Option<&str>,
) -> GuacConnection {
    let target_host = normalize_host(host, public_host_override);
    let mut parameters = BTreeMap::new();
    parameters.insert("hostname".into(), target_host.clone());
    parameters.insert("port".into(), port.to_string());
    parameters.insert("read-only".into(), "false".into());
    parameters.insert("swap-red-blue".into(), "false".into());
    parameters.insert("cursor".into(), "local".into());

    GuacConnection {
        name: format!("libvirt:{vm}"),
        protocol: "vnc".into(),
        target_host,
        target_port: port,
        parameters,
    }
}

fn normalize_host(host: String, public_host_override: Option<&str>) -> String {
    if host == "127.0.0.1" || host == "::1" {
        if let Some(override_host) = public_host_override.filter(|s| !s.is_empty()) {
            return override_host.to_string();
        }
    }
    host
}

/// Full pipeline: display URI → encrypted blob → optional token (standalone binary path).
pub async fn bridge_from_virsh_domdisplay(
    vm: String,
    params: &GuacamoleBridgeParams<'_>,
) -> Result<BridgeResponse> {
    let ep = get_libvirt_display(&vm)?;
    let conn = guac_connection_from_endpoint(&vm, ep, params.public_vnc_host)?;
    bridge_from_connection(vm, conn, params).await
}

/// Daemon path: VNC already resolved via libvirt API (`resolve_vnc_tcp`).
pub async fn bridge_from_vnc_tcp(
    vm: String,
    vnc_host: String,
    vnc_port: u16,
    params: &GuacamoleBridgeParams<'_>,
) -> Result<BridgeResponse> {
    let conn = guac_connection_from_vnc_tcp(&vm, vnc_host, vnc_port, params.public_vnc_host);
    bridge_from_connection(vm, conn, params).await
}

async fn bridge_from_connection(
    vm: String,
    connection: GuacConnection,
    params: &GuacamoleBridgeParams<'_>,
) -> Result<BridgeResponse> {
    let expires_ms = (Utc::now() + Duration::minutes(10)).timestamp_millis();

    let auth_json = json!({
        "username": params.username,
        "expires": expires_ms,
        "connections": {
            connection.name.clone(): {
                "protocol": connection.protocol,
                "parameters": connection.parameters
            }
        }
    });

    let guac_data = encrypt_guacamole_json(&auth_json, params.secret_hex)?;

    let token = if params.fetch_token {
        let http = Client::builder().build()?;
        create_guacamole_token(&http, params.base_url, &guac_data)
            .await
            .ok()
    } else {
        None
    };

    Ok(BridgeResponse {
        vm,
        protocol: connection.protocol,
        target_host: connection.target_host,
        target_port: connection.target_port,
        guac_data,
        token,
    })
}

pub fn encrypt_guacamole_json(auth_json: &Value, secret_hex: &str) -> Result<String> {
    let key = hex_to_bytes(secret_hex)?;
    if key.len() != 16 {
        bail!("Guacamole secret key must be 16 bytes (32 hex digits)");
    }

    let plaintext = serde_json::to_vec(auth_json)?;

    let pkey = PKey::hmac(&key)?;
    let mut signer = Signer::new(MessageDigest::sha256(), &pkey)?;
    signer.update(&plaintext)?;
    let signature = signer.sign_to_vec()?;

    let mut signed = Vec::with_capacity(signature.len() + plaintext.len());
    signed.extend_from_slice(&signature);
    signed.extend_from_slice(&plaintext);

    let iv = [0u8; 16];
    let cipher = Cipher::aes_128_cbc();

    let mut crypter = Crypter::new(cipher, Mode::Encrypt, &key, Some(&iv))?;
    crypter.pad(true);

    let mut ciphertext = vec![0u8; signed.len() + cipher.block_size()];
    let mut count = crypter.update(&signed, &mut ciphertext)?;
    count += crypter.finalize(&mut ciphertext[count..])?;
    ciphertext.truncate(count);

    Ok(BASE64.encode(ciphertext))
}

async fn create_guacamole_token(http: &Client, guac_base_url: &str, data: &str) -> Result<String> {
    let endpoint = format!("{}/api/tokens", guac_base_url.trim_end_matches('/'));

    let resp = http
        .post(endpoint)
        .form(&[("data", data)])
        .send()
        .await
        .context("failed to call Guacamole /api/tokens")?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        bail!("Guacamole rejected token request: {body}");
    }

    let parsed: GuacTokenResponse = resp.json().await?;
    parsed
        .auth_token
        .ok_or_else(|| anyhow!("Guacamole returned success but no authToken"))
}

fn hex_to_bytes(s: &str) -> Result<Vec<u8>> {
    let s = s.trim();
    if s.len() % 2 != 0 {
        bail!("invalid hex length");
    }

    let mut out = Vec::with_capacity(s.len() / 2);
    let bytes = s.as_bytes();

    for i in (0..bytes.len()).step_by(2) {
        let hi = from_hex_digit(bytes[i])?;
        let lo = from_hex_digit(bytes[i + 1])?;
        out.push((hi << 4) | lo);
    }

    Ok(out)
}

fn from_hex_digit(b: u8) -> Result<u8> {
    match b {
        b'0'..=b'9' => Ok(b - b'0'),
        b'a'..=b'f' => Ok(10 + (b - b'a')),
        b'A'..=b'F' => Ok(10 + (b - b'A')),
        _ => bail!("invalid hex digit: {}", b as char),
    }
}
