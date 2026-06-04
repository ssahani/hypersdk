// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
//! GuestKit in-guest agent (virtio channel `com.zyvor.guestkit.0`) — preferred live inventory
//! when `MACHINA_GUEST_AGENT` is `guestkit` or `auto`.

use std::os::unix::net::UnixStream;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

use guestkit_agent_protocol::{read_frame, write_frame, VIRTIO_CHANNEL_NAME};
use serde_json::Value;

use super::guest_agent::{GuestFilesystem, GuestInfo, GuestIpAddress};
use crate::LibvirtError;

/// Backend selection via `MACHINA_GUEST_AGENT`: `auto` | `guestkit` | `qga`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GuestAgentBackend {
    Auto,
    Guestkit,
    Qga,
}

pub fn guest_agent_backend() -> GuestAgentBackend {
    match std::env::var("MACHINA_GUEST_AGENT")
        .unwrap_or_else(|_| "auto".into())
        .to_ascii_lowercase()
        .as_str()
    {
        "guestkit" | "guest-kit" => GuestAgentBackend::Guestkit,
        "qga" | "qemu" => GuestAgentBackend::Qga,
        _ => GuestAgentBackend::Auto,
    }
}

pub fn use_guestkit_backend() -> bool {
    !matches!(guest_agent_backend(), GuestAgentBackend::Qga)
}

pub fn channel_attached_in_xml(xml: &str) -> bool {
    xml.contains(VIRTIO_CHANNEL_NAME)
}

pub fn channel_connected_in_xml(xml: &str) -> bool {
    channel_attached_in_xml(xml)
        && !xml.contains("state='disconnected'")
        && !xml.contains("state=\"disconnected\"")
}

#[cfg(target_os = "linux")]
pub fn channel_socket_path(vm_name: &str) -> Option<PathBuf> {
    let id = domain_target_id(vm_name)?;
    let path = PathBuf::from(format!(
        "/var/lib/libvirt/qemu/channel/target/{id}/{VIRTIO_CHANNEL_NAME}"
    ));
    if path.exists() {
        return Some(path);
    }
    // Fallback: scan channel tree (some libvirt versions use domain name as dir).
    let base = Path::new("/var/lib/libvirt/qemu/channel/target");
    let Ok(entries) = std::fs::read_dir(base) else {
        return None;
    };
    for entry in entries.flatten() {
        let candidate = entry.path().join(VIRTIO_CHANNEL_NAME);
        if candidate.exists() {
            // Best-effort: only return if this domain id matches or name appears in sibling metadata.
            if entry.file_name().to_string_lossy().contains(&id)
                || entry.file_name().to_string_lossy() == vm_name
            {
                return Some(candidate);
            }
        }
    }
    None
}

#[cfg(not(target_os = "linux"))]
pub fn channel_socket_path(_vm_name: &str) -> Option<PathBuf> {
    None
}

#[cfg(target_os = "linux")]
fn domain_target_id(vm_name: &str) -> Option<String> {
    let out = Command::new("virsh")
        .args(["dominfo", vm_name])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&out.stdout);
    for line in text.lines() {
        let line = line.trim();
        if let Some(rest) = line.strip_prefix("Id:") {
            let id = rest.trim();
            if !id.is_empty() {
                return Some(format!("domain-{id}"));
            }
        }
    }
    None
}

#[cfg(not(target_os = "linux"))]
fn domain_target_id(_vm_name: &str) -> Option<String> {
    None
}

fn rpc_call(socket_path: &Path, method: &str, params: Value) -> Option<Value> {
    let mut stream = UnixStream::connect(socket_path).ok()?;
    stream
        .set_read_timeout(Some(Duration::from_secs(30)))
        .ok()?;
    stream
        .set_write_timeout(Some(Duration::from_secs(15)))
        .ok()?;
    let req = serde_json::json!({
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
        "id": 1
    });
    let payload = serde_json::to_vec(&req).ok()?;
    write_frame(&mut stream, &payload).ok()?;
    let frame = read_frame(&mut stream).ok()?;
    let resp: Value = serde_json::from_slice(&frame).ok()?;
    if resp.get("error").is_some() {
        return None;
    }
    resp.get("result").cloned()
}

#[cfg(target_os = "linux")]
pub fn ping(vm_name: &str) -> bool {
    let Some(path) = channel_socket_path(vm_name) else {
        return false;
    };
    rpc_call(&path, "guestkit.ping", Value::Object(Default::default())).is_some()
}

#[cfg(not(target_os = "linux"))]
pub fn ping(_vm_name: &str) -> bool {
    false
}

#[cfg(target_os = "linux")]
pub fn agent_version(vm_name: &str) -> Option<String> {
    let path = channel_socket_path(vm_name)?;
    let result = rpc_call(&path, "guestkit.getVersion", Value::Object(Default::default()))?;
    result
        .get("version")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

#[cfg(not(target_os = "linux"))]
pub fn agent_version(_vm_name: &str) -> Option<String> {
    None
}

#[cfg(target_os = "linux")]
pub fn fetch_evidence_json(vm_name: &str) -> Option<Value> {
    let path = channel_socket_path(vm_name)?;
    rpc_call(
        &path,
        "guestkit.getEvidence",
        Value::Object(Default::default()),
    )
}

#[cfg(not(target_os = "linux"))]
pub fn fetch_evidence_json(_vm_name: &str) -> Option<Value> {
    None
}

/// Map GuestKit evidence JSON into Machina `GuestInfo` (IPs still filled by libvirt merge).
pub fn guest_info_from_evidence(evidence: &Value, existing_ips: Vec<GuestIpAddress>) -> GuestInfo {
    let os = evidence.get("os").cloned().unwrap_or(Value::Null);
    let hostname = os
        .get("hostname")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let os_type = os
        .get("os_type")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let distribution = os
        .get("distribution")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let version = os
        .get("version")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let arch = os
        .get("architecture")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let mut filesystems = Vec::new();
    if let Some(fstab) = evidence
        .get("storage")
        .and_then(|s| s.get("fstab_entries"))
        .and_then(|v| v.as_array())
    {
        for entry in fstab {
            let mountpoint = entry
                .get("mountpoint")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            if mountpoint.is_empty() || mountpoint == "swap" {
                continue;
            }
            filesystems.push(GuestFilesystem {
                mountpoint: mountpoint.clone(),
                name: entry
                    .get("device")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                fs_type: entry
                    .get("fstype")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                total_bytes: 0,
                used_bytes: 0,
            });
        }
    }

    let cloud_init_status = evidence
        .get("boot")
        .and_then(|b| b.get("cloud_init_present"))
        .and_then(|v| v.as_bool())
        .map(|present| {
            if present {
                "cloud-init present (GuestKit evidence)".into()
            } else {
                "no cloud-init directory".into()
            }
        });

    GuestInfo {
        hostname,
        os_type: if os_type.is_empty() {
            "linux".into()
        } else {
            os_type
        },
        os_version: version,
        os_pretty_name: if distribution.is_empty() {
            None
        } else {
            Some(distribution.to_string())
        },
        os_kernel: evidence
            .get("boot")
            .and_then(|b| b.get("kernel_cmdline"))
            .and_then(|v| v.as_str())
            .map(|s| s.chars().take(120).collect()),
        os_arch: arch,
        cloud_init_status,
        ip_addresses: existing_ips,
        filesystems,
        users: Vec::new(),
        time: None,
        fs_freeze: None,
    }
}

pub const GUESTKIT_CHANNEL_XML: &str = r#"<channel type='unix'>
  <target type='virtio' name='com.zyvor.guestkit.0'/>
</channel>"#;

pub fn attach_guestkit_channel(
    dom: &virt::domain::Domain,
) -> Result<(), LibvirtError> {
    let xml = dom
        .get_xml_desc(0)
        .map_err(|e| LibvirtError::Operation(e.to_string()))?;
    if channel_attached_in_xml(&xml) {
        return Ok(());
    }
    let flags = virt::sys::VIR_DOMAIN_AFFECT_CONFIG | virt::sys::VIR_DOMAIN_AFFECT_LIVE;
    dom.attach_device_flags(GUESTKIT_CHANNEL_XML, flags)
        .map_err(|e| LibvirtError::Operation(format!("attach GuestKit channel: {e}")))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_guestkit_channel_in_xml() {
        let xml = "<channel type='unix'><target type='virtio' name='com.zyvor.guestkit.0'/></channel>";
        assert!(channel_attached_in_xml(xml));
        assert!(channel_connected_in_xml(xml));
    }
}
