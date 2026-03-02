use virt::connect::Connect;

use super::domain::lookup_domain;
use crate::LibvirtError;

pub fn set_vcpus(conn: &Connect, name: &str, vcpus: u32) -> Result<(), LibvirtError> {
    crate::validate::validate_vcpus(vcpus)?;

    let domain = lookup_domain(conn, name)?;
    domain
        .set_vcpus_flags(vcpus, virt::sys::VIR_DOMAIN_AFFECT_CONFIG)
        .map_err(LibvirtError::map_op("Failed to set vCPUs for '{name}'"))?;
    Ok(())
}

pub fn set_memory(conn: &Connect, name: &str, memory_mb: u64) -> Result<(), LibvirtError> {
    crate::validate::validate_memory_mb(memory_mb)?;

    let domain = lookup_domain(conn, name)?;
    domain
        .set_max_memory(memory_mb * 1024)
        .map_err(LibvirtError::map_op("Failed to set memory for '{name}'"))?;
    Ok(())
}
