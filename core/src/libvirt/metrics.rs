use tracing::warn;
use virt::connect::Connect;
use virt::domain::Domain;

use super::domain::lookup_domain;
use crate::host_linux_obs;
use crate::state::{VmBlockDeviceMetrics, VmMetrics, VmNetDeviceMetrics};
use crate::LibvirtError;

// libvirt memory stat tag constants
const VIR_DOMAIN_MEMORY_STAT_UNUSED: u32 = 4;
const VIR_DOMAIN_MEMORY_STAT_AVAILABLE: u32 = 6;
const VIR_DOMAIN_MEMORY_STAT_ACTUAL_BALLOON: u32 = 8;
const VIR_DOMAIN_MEMORY_STAT_RSS: u32 = 9;

pub fn get_vm_metrics(conn: &Connect, name: &str) -> Result<VmMetrics, LibvirtError> {
    let domain = lookup_domain(conn, name)?;

    collect_domain_metrics(&domain, name)
}

pub fn get_all_vm_metrics(conn: &Connect) -> Result<Vec<VmMetrics>, LibvirtError> {
    let domains = conn
        .list_all_domains(0)
        .map_err(LibvirtError::map_op("Failed to list domains"))?;

    let mut metrics = Vec::new();
    for domain in domains {
        let name = domain.get_name().unwrap_or_default();
        let info = match domain.get_info() {
            Ok(i) => i,
            Err(e) => {
                warn!("Failed to get info for VM '{}': {}", name, e);
                continue;
            }
        };

        // Only collect metrics for running VMs (state 1 = VIR_DOMAIN_RUNNING)
        if info.state != 1
        /* VIR_DOMAIN_RUNNING */
        {
            continue;
        }

        match collect_domain_metrics(&domain, &name) {
            Ok(m) => metrics.push(m),
            Err(e) => warn!("Failed to collect metrics for VM '{}': {}", name, e),
        }
    }

    Ok(metrics)
}

fn collect_domain_metrics(domain: &Domain, name: &str) -> Result<VmMetrics, LibvirtError> {
    let info = domain
        .get_info()
        .map_err(LibvirtError::map_op("Failed to get domain info"))?;

    let cpu_time_ns = info.cpu_time;

    // Memory stats
    let mem_stats = match domain.memory_stats(16) {
        Ok(stats) => stats,
        Err(e) => {
            warn!("Failed to get memory stats for VM '{}': {}", name, e);
            Vec::new()
        }
    };
    let mut actual_kb: u64 = 0;
    let mut available_kb: u64 = 0;
    let mut unused_kb: u64 = 0;
    let mut rss_kb: u64 = 0;

    for stat in &mem_stats {
        match stat.tag {
            VIR_DOMAIN_MEMORY_STAT_UNUSED => unused_kb = stat.val,
            VIR_DOMAIN_MEMORY_STAT_AVAILABLE => actual_kb = stat.val,
            VIR_DOMAIN_MEMORY_STAT_ACTUAL_BALLOON => available_kb = stat.val,
            VIR_DOMAIN_MEMORY_STAT_RSS => rss_kb = stat.val,
            _ => {}
        }
    }

    let memory_total_mb = if actual_kb > 0 {
        actual_kb / 1024
    } else {
        info.memory / 1024
    };

    let memory_used_mb = if available_kb > 0 && unused_kb > 0 {
        (available_kb.saturating_sub(unused_kb)) / 1024
    } else if rss_kb > 0 {
        rss_kb / 1024
    } else {
        0
    };

    let memory_pct = if memory_total_mb > 0 {
        (memory_used_mb as f64 / memory_total_mb as f64 * 100.0).min(100.0)
    } else {
        0.0
    };

    let (disks, disk_rd_bytes, disk_wr_bytes) = collect_block_stats(domain);
    let (nets, net_rx_bytes, net_tx_bytes) = collect_net_stats(domain);
    let cgroup = {
        let cg = host_linux_obs::read_vm_cgroup_v2(name);
        if cg.available {
            Some(cg)
        } else {
            None
        }
    };

    Ok(VmMetrics {
        name: name.to_string(),
        cpu_time_ns,
        vcpus: info.nr_virt_cpu,
        memory_total_mb,
        memory_used_mb,
        memory_pct,
        disk_rd_bytes,
        disk_wr_bytes,
        net_rx_bytes,
        net_tx_bytes,
        disks,
        nets,
        cgroup,
        libvirt_connection: None,
    })
}

fn collect_block_stats(domain: &Domain) -> (Vec<VmBlockDeviceMetrics>, u64, u64) {
    let mut disks = Vec::new();
    let mut rd_total: u64 = 0;
    let mut wr_total: u64 = 0;

    if let Ok(xml) = domain.get_xml_desc(0) {
        for block in crate::xml::split_blocks(&xml, "disk") {
            if let Some(target) = crate::xml::extract_attr(&block, "target", "dev") {
                if let Ok(stats) = domain.get_block_stats(&target) {
                    let rd_bytes = stats.rd_bytes.max(0) as u64;
                    let wr_bytes = stats.wr_bytes.max(0) as u64;
                    let rd_ops = stats.rd_req.max(0) as u64;
                    let wr_ops = stats.wr_req.max(0) as u64;
                    rd_total += rd_bytes;
                    wr_total += wr_bytes;
                    disks.push(VmBlockDeviceMetrics {
                        device: target,
                        rd_bytes,
                        wr_bytes,
                        rd_ops,
                        wr_ops,
                    });
                }
            }
        }
    }

    disks.sort_by(|a, b| a.device.cmp(&b.device));
    (disks, rd_total, wr_total)
}

fn collect_net_stats(domain: &Domain) -> (Vec<VmNetDeviceMetrics>, u64, u64) {
    let mut nets = Vec::new();
    let mut rx_total: u64 = 0;
    let mut tx_total: u64 = 0;

    if let Ok(xml) = domain.get_xml_desc(0) {
        for block in crate::xml::split_blocks(&xml, "interface") {
            if let Some(target) = crate::xml::extract_attr(&block, "target", "dev") {
                if let Ok(stats) = domain.interface_stats(&target) {
                    let rx_bytes = stats.rx_bytes.max(0) as u64;
                    let tx_bytes = stats.tx_bytes.max(0) as u64;
                    let rx_packets = stats.rx_packets.max(0) as u64;
                    let tx_packets = stats.tx_packets.max(0) as u64;
                    rx_total += rx_bytes;
                    tx_total += tx_bytes;
                    nets.push(VmNetDeviceMetrics {
                        device: target,
                        rx_bytes,
                        tx_bytes,
                        rx_packets,
                        tx_packets,
                    });
                }
            }
        }
    }

    nets.sort_by(|a, b| a.device.cmp(&b.device));
    (nets, rx_total, tx_total)
}
