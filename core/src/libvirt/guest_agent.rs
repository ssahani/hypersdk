use virt::connect::Connect;

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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuestFilesystem {
    pub mountpoint: String,
    pub name: String,
    pub fs_type: String,
    pub total_bytes: u64,
    pub used_bytes: u64,
}

pub fn get_guest_interfaces(
    conn: &Connect,
    name: &str,
) -> Result<Vec<GuestIpAddress>, LibvirtError> {
    let domain = lookup_domain(conn, name)?;
    let ifaces = domain
        .interface_addresses(virt::sys::VIR_DOMAIN_INTERFACE_ADDRESSES_SRC_LEASE, 0)
        .or_else(|_| {
            domain.interface_addresses(virt::sys::VIR_DOMAIN_INTERFACE_ADDRESSES_SRC_AGENT, 0)
        })
        .unwrap_or_default();

    let mut result = Vec::new();
    for iface in &ifaces {
        for addr in &iface.addrs {
            result.push(GuestIpAddress {
                name: iface.name.clone(),
                mac: iface.hwaddr.clone(),
                ip_type: if addr.typed == 0 {
                    "ipv4".to_string()
                } else {
                    "ipv6".to_string()
                },
                address: addr.addr.clone(),
                prefix: addr.prefix as u32,
            });
        }
    }
    Ok(result)
}

pub fn get_guest_hostname(conn: &Connect, name: &str) -> Result<String, LibvirtError> {
    let domain = lookup_domain(conn, name)?;
    domain
        .get_hostname(0)
        .map_err(LibvirtError::map_op("Failed to get guest hostname"))
}
