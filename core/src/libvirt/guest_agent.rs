// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

use std::collections::HashSet;

use chrono::Local;
use chrono::NaiveDateTime;
use chrono::TimeZone;
use virt::connect::Connect;
use virt::domain::Domain;

use super::domain::lookup_domain;
use super::extras::DhcpLease;
use crate::LibvirtError;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuestInfo {
    pub hostname: String,
    pub os_type: String,
    pub os_version: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub os_pretty_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub os_kernel: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub os_arch: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cloud_init_status: Option<String>,
    pub ip_addresses: Vec<GuestIpAddress>,
    pub filesystems: Vec<GuestFilesystem>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub users: Vec<super::guest_agent_actions::GuestUserSession>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub time: Option<super::guest_agent_actions::GuestTimeInfo>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fs_freeze: Option<super::guest_agent_actions::FsFreezeStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuestIpAddress {
    pub name: String,
    pub mac: String,
    pub ip_type: String,
    pub address: String,
    pub prefix: u32,
    /// Which [`virDomainInterfaceAddresses`] source produced this row when merging (first wins).
    /// `lease` → DHCP lease file; `arp` → kernel ARP; `agent` → qemu-guest-agent.
    pub source: String,
    /// Hostname from libvirt’s DHCP lease table (same network / dnsmasq), when matched by IP or MAC.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dhcp_hostname: Option<String>,
    /// Parsed DHCP expiry time from `virsh net-dhcp-leases` when matched.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dhcp_expires_at: Option<String>,
    /// Seconds until `dhcp_expires_at` from snapshot time (negative = expired).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lease_seconds_remaining: Option<i64>,
    /// Reverse DNS (PTR) for this IP when resolvable (filled by daemon).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dns_ptr: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuestFilesystem {
    pub mountpoint: String,
    pub name: String,
    pub fs_type: String,
    pub total_bytes: u64,
    pub used_bytes: u64,
}

fn iface_addrs(domain: &Domain, src: u32) -> Vec<virt::domain::Interface> {
    domain.interface_addresses(src, 0).unwrap_or_default()
}

fn push_ifaces(
    out: &mut Vec<GuestIpAddress>,
    seen: &mut HashSet<(String, String, String)>,
    ifaces: &[virt::domain::Interface],
    source: &'static str,
) {
    for iface in ifaces {
        for addr in &iface.addrs {
            let key = (iface.name.clone(), iface.hwaddr.clone(), addr.addr.clone());
            if seen.insert(key) {
                out.push(GuestIpAddress {
                    name: iface.name.clone(),
                    mac: iface.hwaddr.clone(),
                    ip_type: if addr.typed == 0 {
                        "ipv4".to_string()
                    } else {
                        "ipv6".to_string()
                    },
                    address: addr.addr.clone(),
                    prefix: addr.prefix as u32,
                    source: source.to_string(),
                    dhcp_hostname: None,
                    dhcp_expires_at: None,
                    lease_seconds_remaining: None,
                    dns_ptr: None,
                });
            }
        }
    }
}

/// DHCP lease first, then ARP table, then QEMU guest agent (Cockpit-machines order).
pub fn get_guest_interfaces(
    conn: &Connect,
    name: &str,
) -> Result<Vec<GuestIpAddress>, LibvirtError> {
    let domain = lookup_domain(conn, name)?;
    let mut result = Vec::new();
    let mut seen = HashSet::new();

    push_ifaces(
        &mut result,
        &mut seen,
        &iface_addrs(&domain, virt::sys::VIR_DOMAIN_INTERFACE_ADDRESSES_SRC_LEASE),
        "lease",
    );
    push_ifaces(
        &mut result,
        &mut seen,
        &iface_addrs(&domain, virt::sys::VIR_DOMAIN_INTERFACE_ADDRESSES_SRC_ARP),
        "arp",
    );
    push_ifaces(
        &mut result,
        &mut seen,
        &iface_addrs(&domain, virt::sys::VIR_DOMAIN_INTERFACE_ADDRESSES_SRC_AGENT),
        "agent",
    );

    Ok(result)
}

fn norm_mac(m: &str) -> String {
    m.to_lowercase().replace('-', ":")
}

fn parse_virsh_expiry(s: &str) -> Option<chrono::DateTime<chrono::Utc>> {
    if s.is_empty() || s == "-" {
        return None;
    }
    let ndt = NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S").ok()?;
    Local
        .from_local_datetime(&ndt)
        .single()
        .map(|dt| dt.with_timezone(&chrono::Utc))
}

/// Merge [`DhcpLease`] rows from `virsh net-dhcp-leases` into addresses (match IP or MAC).
pub fn enrich_with_dhcp_leases(
    mut addrs: Vec<GuestIpAddress>,
    leases: &[DhcpLease],
) -> Vec<GuestIpAddress> {
    use chrono::Utc;
    let now = Utc::now();
    for a in &mut addrs {
        for l in leases {
            let mac_ok = !a.mac.is_empty() && norm_mac(&a.mac) == norm_mac(&l.mac);
            let ip_ok = !l.ip.is_empty() && a.address == l.ip;
            if !(mac_ok || ip_ok) {
                continue;
            }
            if !l.hostname.is_empty() {
                a.dhcp_hostname = Some(l.hostname.clone());
            }
            if let Some(exp) = parse_virsh_expiry(&l.expiry) {
                a.dhcp_expires_at = Some(exp.to_rfc3339());
                a.lease_seconds_remaining = Some((exp - now).num_seconds());
            }
            break;
        }
    }
    addrs
}

pub fn get_guest_hostname(conn: &Connect, name: &str) -> Result<String, LibvirtError> {
    let domain = lookup_domain(conn, name)?;
    domain
        .get_hostname(0)
        .map_err(LibvirtError::map_op("Failed to get guest hostname"))
}

/// Guest filesystem usage via qemu-guest-agent (`guest-get-fsinfo`).
pub fn get_guest_filesystems(conn: &Connect, name: &str) -> Result<Vec<GuestFilesystem>, LibvirtError> {
    let domain = lookup_domain(conn, name)?;
    if !domain.is_active().unwrap_or(false) {
        return Ok(Vec::new());
    }
    guest_fsinfo_via_agent(name)
}

#[cfg(target_os = "linux")]
fn guest_fsinfo_via_agent(vm_name: &str) -> Result<Vec<GuestFilesystem>, LibvirtError> {
    use std::process::Command;
    let output = Command::new("virsh")
        .args([
            "qemu-agent-command",
            vm_name,
            r#"{"execute":"guest-get-fsinfo"}"#,
        ])
        .output()
        .map_err(|e| LibvirtError::Operation(format!("virsh qemu-agent-command: {e}")))?;
    if !output.status.success() {
        return Ok(Vec::new());
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let v: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| LibvirtError::Operation(format!("agent JSON: {e}")))?;
    let Some(arr) = v.get("return").and_then(|r| r.as_array()) else {
        return Ok(Vec::new());
    };
    let mut out = Vec::new();
    for item in arr {
        let mountpoint = item
            .get("mountpoint")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string();
        let fstype = item
            .get("type")
            .or_else(|| item.get("fstype"))
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string();
        let name = item
            .get("name")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string();
        let (total_bytes, used_bytes) = item
            .get("total-bytes")
            .and_then(|x| x.as_u64())
            .map(|total| {
                let used = item
                    .get("used-bytes")
                    .and_then(|x| x.as_u64())
                    .unwrap_or(0);
                (total, used)
            })
            .or_else(|| {
                item.get("disk")
                    .and_then(|d| {
                        let total = d.get("total-bytes")?.as_u64()?;
                        let used = d.get("used-bytes").and_then(|x| x.as_u64()).unwrap_or(0);
                        Some((total, used))
                    })
            })
            .unwrap_or((0, 0));
        if mountpoint.is_empty() {
            continue;
        }
        out.push(GuestFilesystem {
            mountpoint,
            name,
            fs_type: fstype,
            total_bytes,
            used_bytes,
        });
    }
    Ok(out)
}

#[cfg(not(target_os = "linux"))]
fn guest_fsinfo_via_agent(_vm_name: &str) -> Result<Vec<GuestFilesystem>, LibvirtError> {
    Ok(Vec::new())
}

/// Combined guest agent snapshot for observability APIs.
pub fn get_guest_observability(conn: &Connect, name: &str) -> Result<GuestInfo, LibvirtError> {
    let hostname = get_guest_hostname(conn, name).unwrap_or_default();
    let mut ip_addresses = get_guest_interfaces(conn, name).unwrap_or_default();
    if let Ok(leases) = super::extras::list_dhcp_leases(conn) {
        ip_addresses = enrich_with_dhcp_leases(ip_addresses, &leases);
    }

    let filesystems = get_guest_filesystems(conn, name).unwrap_or_default();
    let (os_type, os_version, os_pretty_name, os_kernel, os_arch) = probe_guest_osinfo(name);
    let cloud_init_status = probe_cloud_init_status(name);
    let agent_live = agent_ping_ok(name);
    let users = if agent_live {
        super::guest_agent_actions::get_guest_users(name)
    } else {
        Vec::new()
    };
    let time = if agent_live {
        super::guest_agent_actions::get_guest_time_info(conn, name).ok()
    } else {
        None
    };
    let fs_freeze = if agent_live {
        Some(super::guest_agent_actions::get_fs_freeze_status(name))
    } else {
        None
    };
    Ok(GuestInfo {
        hostname,
        os_type,
        os_version,
        os_pretty_name,
        os_kernel,
        os_arch,
        cloud_init_status,
        ip_addresses,
        filesystems,
        users,
        time,
        fs_freeze,
    })
}

pub fn probe_guest_osinfo(vm_name: &str) -> (String, String, Option<String>, Option<String>, Option<String>) {
    #[cfg(not(target_os = "linux"))]
    {
        let _ = vm_name;
        return (String::new(), String::new(), None, None, None);
    }
    #[cfg(target_os = "linux")]
    {
        let Some(v) = qemu_agent_json(
            vm_name,
            r#"{"execute":"guest-get-osinfo","arguments":{}}"#,
        ) else {
            return (String::new(), String::new(), None, None, None);
        };
        let ret = v.get("return").unwrap_or(&v);
        let id = ret
            .get("id")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string();
        let name = ret
            .get("name")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string();
        let pretty = ret
            .get("pretty-name")
            .or_else(|| ret.get("pretty_name"))
            .and_then(|x| x.as_str())
            .map(|s| s.to_string());
        let kernel = ret
            .get("kernel-release")
            .or_else(|| ret.get("kernel_release"))
            .and_then(|x| x.as_str())
            .map(|s| s.to_string());
        let arch = ret
            .get("machine")
            .or_else(|| ret.get("arch"))
            .and_then(|x| x.as_str())
            .map(|s| s.to_string());
        (id, name, pretty, kernel, arch)
    }
}

pub fn probe_cloud_init_status(vm_name: &str) -> Option<String> {
    #[cfg(not(target_os = "linux"))]
    {
        let _ = vm_name;
        return None;
    }
    #[cfg(target_os = "linux")]
    {
        let v = qemu_agent_json(
            vm_name,
            r#"{"execute":"guest-exec","arguments":{"path":"cloud-init","arg":["status","--long"],"capture-output":true}}"#,
        )?;
        let pid = v.get("return")?.get("pid")?.as_u64()?;
        std::thread::sleep(std::time::Duration::from_millis(400));
        let st = qemu_agent_json(
            vm_name,
            &format!(r#"{{"execute":"guest-exec-status","arguments":{{"pid":{pid}}}}}"#),
        )?;
        let out_b64 = st
            .get("return")?
            .get("out-data")
            .and_then(|x| x.as_str())?;
        let decoded = base64_decode(out_b64)?;
        let text = String::from_utf8_lossy(&decoded);
        Some(text.lines().next().unwrap_or("").chars().take(200).collect())
    }
}

#[cfg(target_os = "linux")]
fn agent_ping_ok(vm_name: &str) -> bool {
    qemu_agent_command(vm_name, r#"{"execute":"guest-ping"}"#)
        .and_then(|v| v.get("return").cloned())
        .is_some()
}

#[cfg(not(target_os = "linux"))]
fn agent_ping_ok(_vm_name: &str) -> bool {
    false
}

/// Run a single QEMU guest-agent JSON command via virsh (Linux hypervisors only).
#[cfg(target_os = "linux")]
pub fn qemu_agent_command(vm_name: &str, cmd_json: &str) -> Option<serde_json::Value> {
    qemu_agent_json(vm_name, cmd_json)
}

#[cfg(target_os = "linux")]
fn qemu_agent_json(vm_name: &str, cmd_json: &str) -> Option<serde_json::Value> {
    use std::process::Command;
    let out = Command::new("virsh")
        .args(["qemu-agent-command", vm_name, cmd_json])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&out.stdout);
    serde_json::from_str(&text).ok()
}

#[cfg(target_os = "linux")]
fn base64_decode(s: &str) -> Option<Vec<u8>> {
  use base64::Engine;
  base64::engine::general_purpose::STANDARD.decode(s.trim()).ok()
}
