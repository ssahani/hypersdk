use virt::connect::Connect;
use virt::domain::Domain;

use crate::LibvirtError;

pub fn set_vcpus(conn: &Connect, name: &str, vcpus: u32) -> Result<(), LibvirtError> {
    crate::validate::validate_vcpus(vcpus)?;

    let domain = Domain::lookup_by_name(conn, name)
        .map_err(|e| LibvirtError::NotFound(format!("VM '{name}' not found: {e}")))?;

    // Set max vCPUs in config (takes effect on next boot)
    domain
        .set_vcpus_flags(vcpus, virt::sys::VIR_DOMAIN_AFFECT_CONFIG)
        .map_err(|e| LibvirtError::Operation(format!("Failed to set vCPUs for '{name}': {e}")))?;

    Ok(())
}

pub fn set_memory(conn: &Connect, name: &str, memory_mb: u64) -> Result<(), LibvirtError> {
    crate::validate::validate_memory_mb(memory_mb)?;

    let domain = Domain::lookup_by_name(conn, name)
        .map_err(|e| LibvirtError::NotFound(format!("VM '{name}' not found: {e}")))?;

    let memory_kib = memory_mb * 1024;

    // Set max memory in config (takes effect on next boot)
    domain
        .set_max_memory(memory_kib)
        .map_err(|e| LibvirtError::Operation(format!("Failed to set memory for '{name}': {e}")))?;

    Ok(())
}
