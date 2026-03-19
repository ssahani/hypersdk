use virt::connect::Connect;

use super::domain::lookup_domain;
use crate::LibvirtError;

pub fn set_vcpus(conn: &Connect, name: &str, vcpus: u32) -> Result<(), LibvirtError> {
    crate::validate::validate_vcpus(vcpus)?;

    let domain = lookup_domain(conn, name)?;
    domain
        .set_vcpus_flags(vcpus, virt::sys::VIR_DOMAIN_AFFECT_CONFIG)
        .map_err(|e| LibvirtError::Operation(format!("Failed to set vCPUs for '{name}': {e}")))?;
    Ok(())
}

pub fn set_memory(conn: &Connect, name: &str, memory_mb: u64) -> Result<(), LibvirtError> {
    crate::validate::validate_memory_mb(memory_mb)?;

    let domain = lookup_domain(conn, name)?;
    domain
        .set_max_memory(memory_mb * 1024)
        .map_err(|e| LibvirtError::Operation(format!("Failed to set memory for '{name}': {e}")))?;
    Ok(())
}

pub fn pin_vcpu(conn: &Connect, name: &str, vcpu: u32, cpus: &[bool]) -> Result<(), LibvirtError> {
    let domain = lookup_domain(conn, name)?;
    let cpumap: Vec<u8> = cpus.chunks(8).map(|chunk| {
        chunk.iter().enumerate().fold(0u8, |acc, (i, &set)| if set { acc | (1 << i) } else { acc })
    }).collect();
    domain
        .pin_vcpu(vcpu, &cpumap)
        .map_err(|e| LibvirtError::Operation(format!("Failed to pin vCPU {vcpu} for '{name}': {e}")))?;
    Ok(())
}

pub fn set_memory_balloon(conn: &Connect, name: &str, memory_mb: u64) -> Result<(), LibvirtError> {
    let domain = lookup_domain(conn, name)?;
    domain
        .set_memory(memory_mb * 1024)
        .map_err(|e| LibvirtError::Operation(format!("Failed to balloon memory for '{name}': {e}")))?;
    Ok(())
}
