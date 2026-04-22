use virt::connect::Connect;
use virt::domain::{MemoryParameters, SchedulerInfo};
use virt::sys::virDomainModificationImpact;

use super::device::get_domain_flags_pub;
use super::domain::lookup_domain;
use crate::{LibvirtError, xml};

#[derive(serde::Serialize, serde::Deserialize, Default)]
pub struct CpuTuneInfo {
    pub shares: Option<u64>,
    pub period: Option<u64>,
    pub quota: Option<i64>,
    pub vcpupin: Vec<VcpuPin>,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct VcpuPin {
    pub vcpu: u32,
    pub cpuset: String,
}

#[derive(Clone, serde::Serialize, serde::Deserialize, Default)]
pub struct MemTuneInfo {
    pub hard_limit_kb: Option<u64>,
    pub soft_limit_kb: Option<u64>,
    pub swap_hard_limit_kb: Option<u64>,
}

pub fn get_cputune(conn: &Connect, name: &str) -> Result<CpuTuneInfo, LibvirtError> {
    let domain = lookup_domain(conn, name)?;
    let xml_str = domain.get_xml_desc(0).map_err(LibvirtError::map_op("get XML"))?;
    let mut info = CpuTuneInfo::default();
    if let Some(block) = xml::extract_text(&xml_str, "cputune") {
        if let Some(s) = xml::extract_simple_text(&block, "shares") { info.shares = s.trim().parse().ok(); }
        if let Some(p) = xml::extract_simple_text(&block, "period") { info.period = p.trim().parse().ok(); }
        if let Some(q) = xml::extract_simple_text(&block, "quota") { info.quota = q.trim().parse().ok(); }
    }
    // Parse vcpupin entries
    for block in xml::split_blocks(&xml_str, "vcpupin") {
        if let (Some(vcpu), Some(cpuset)) = (xml::extract_attr(&block, "vcpupin", "vcpu"), xml::extract_attr(&block, "vcpupin", "cpuset")) {
            if let Ok(v) = vcpu.parse() {
                info.vcpupin.push(VcpuPin { vcpu: v, cpuset });
            }
        }
    }
    Ok(info)
}

pub fn get_memtune(conn: &Connect, name: &str) -> Result<MemTuneInfo, LibvirtError> {
    let domain = lookup_domain(conn, name)?;
    let xml_str = domain.get_xml_desc(0).map_err(LibvirtError::map_op("get XML"))?;
    let mut info = MemTuneInfo::default();
    if let Some(block) = xml::extract_text(&xml_str, "memtune") {
        if let Some(v) = xml::extract_simple_text(&block, "hard_limit") { info.hard_limit_kb = v.trim().parse().ok(); }
        if let Some(v) = xml::extract_simple_text(&block, "soft_limit") { info.soft_limit_kb = v.trim().parse().ok(); }
        if let Some(v) = xml::extract_simple_text(&block, "swap_hard_limit") { info.swap_hard_limit_kb = v.trim().parse().ok(); }
    }
    Ok(info)
}

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
    let cpumap: Vec<u8> = cpus
        .chunks(8)
        .map(|chunk| {
            chunk
                .iter()
                .enumerate()
                .fold(0u8, |acc, (i, &set)| if set { acc | (1 << i) } else { acc })
        })
        .collect();
    let flags = get_domain_flags_pub(&domain);
    domain
        .pin_vcpu_flags(vcpu, &cpumap, flags)
        .map_err(|e| LibvirtError::Operation(format!("Failed to pin vCPU {vcpu} for '{name}': {e}")))?;
    Ok(())
}

const AFFECT_LIVE_AND_CONFIG: virDomainModificationImpact =
    virt::sys::VIR_DOMAIN_AFFECT_LIVE | virt::sys::VIR_DOMAIN_AFFECT_CONFIG;

/// Apply memtune limits (KiB). Unspecified fields keep their current libvirt values.
pub fn set_memtune_kb(conn: &Connect, name: &str, req: &MemTuneInfo) -> Result<(), LibvirtError> {
    let domain = lookup_domain(conn, name)?;
    let mut p: MemoryParameters = domain
        .get_memory_parameters(AFFECT_LIVE_AND_CONFIG as u32)
        .map_err(|e| LibvirtError::Operation(format!("get_memory_parameters: {e}")))?;
    if let Some(v) = req.hard_limit_kb {
        p.hard_limit = Some(v);
    }
    if let Some(v) = req.soft_limit_kb {
        p.soft_limit = Some(v);
    }
    if let Some(v) = req.swap_hard_limit_kb {
        p.swap_hard_limit = Some(v);
    }
    domain
        .set_memory_parameters(p, AFFECT_LIVE_AND_CONFIG as u32)
        .map_err(|e| LibvirtError::Operation(format!("set_memory_parameters: {e}")))?;
    Ok(())
}

/// Update fair-scheduler fields (`cpu_shares`, `vcpu` bandwidth `period`/`quota`) on live + persistent config.
/// Unspecified fields keep their current values.
pub fn set_cpu_scheduler_partial(
    conn: &Connect,
    name: &str,
    cpu_shares: Option<u64>,
    vcpu_period: Option<u64>,
    vcpu_quota: Option<i64>,
) -> Result<(), LibvirtError> {
    let domain = lookup_domain(conn, name)?;
    let mut s: SchedulerInfo = domain
        .get_scheduler_parameters_flags(AFFECT_LIVE_AND_CONFIG)
        .map_err(|e| LibvirtError::Operation(format!("get_scheduler_parameters_flags: {e}")))?;
    if let Some(v) = cpu_shares {
        s.cpu_shares = Some(v);
    }
    if let Some(v) = vcpu_period {
        s.vcpu_bw.period = Some(v);
    }
    if let Some(v) = vcpu_quota {
        s.vcpu_bw.quota = Some(v);
    }
    domain
        .set_scheduler_parameters_flags(&s, AFFECT_LIVE_AND_CONFIG)
        .map_err(|e| LibvirtError::Operation(format!("set_scheduler_parameters_flags: {e}")))?;
    Ok(())
}

pub fn set_memory_balloon(conn: &Connect, name: &str, memory_mb: u64) -> Result<(), LibvirtError> {
    crate::validate::validate_memory_mb(memory_mb)?;
    let domain = lookup_domain(conn, name)?;
    domain
        .set_memory(memory_mb * 1024)
        .map_err(|e| LibvirtError::Operation(format!("Failed to balloon memory for '{name}': {e}")))?;
    Ok(())
}
