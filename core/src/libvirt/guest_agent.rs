use std::collections::HashSet;

use virt::connect::Connect;
use virt::domain::Domain;

use super::domain::lookup_domain;
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
            let key = (
                iface.name.clone(),
                iface.hwaddr.clone(),
                addr.addr.clone(),
            );
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

pub fn get_guest_hostname(conn: &Connect, name: &str) -> Result<String, LibvirtError> {
    let domain = lookup_domain(conn, name)?;
    domain
        .get_hostname(0)
        .map_err(LibvirtError::map_op("Failed to get guest hostname"))
}
