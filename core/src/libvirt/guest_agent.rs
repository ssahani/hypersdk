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
    pub ip_addresses: Vec<GuestIpAddress>,
    pub filesystems: Vec<GuestFilesystem>,
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
