use virt::connect::Connect;
use virt::domain::Domain;

use crate::state::VmMetrics;
use crate::LibvirtError;

pub fn get_vm_metrics(conn: &Connect, name: &str) -> Result<VmMetrics, LibvirtError> {
    let domain = Domain::lookup_by_name(conn, name)
        .map_err(|e| LibvirtError::NotFound(format!("VM '{name}' not found: {e}")))?;

    collect_domain_metrics(&domain, name)
}

pub fn get_all_vm_metrics(conn: &Connect) -> Result<Vec<VmMetrics>, LibvirtError> {
    let domains = conn
        .list_all_domains(0)
        .map_err(|e| LibvirtError::Operation(format!("Failed to list domains: {e}")))?;

    let mut metrics = Vec::new();
    for domain in domains {
        let name = domain.get_name().unwrap_or_default();
        let info = match domain.get_info() {
            Ok(i) => i,
            Err(_) => continue,
        };

        // Only collect metrics for running VMs
        if info.state != 1 {
            continue;
        }

        if let Ok(m) = collect_domain_metrics(&domain, &name) {
            metrics.push(m);
        }
    }

    Ok(metrics)
}

fn collect_domain_metrics(domain: &Domain, name: &str) -> Result<VmMetrics, LibvirtError> {
    let info = domain
        .get_info()
        .map_err(|e| LibvirtError::Operation(format!("Failed to get domain info: {e}")))?;

    let cpu_time_ns = info.cpu_time;

    // Memory stats
    let mem_stats = domain.memory_stats(16).unwrap_or_default();
    let mut actual_kb: u64 = 0;
    let mut available_kb: u64 = 0;
    let mut unused_kb: u64 = 0;
    let mut rss_kb: u64 = 0;

    for stat in &mem_stats {
        match stat.tag {
            6 => actual_kb = stat.val,
            8 => available_kb = stat.val,
            4 => unused_kb = stat.val,
            9 => rss_kb = stat.val,
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

    // Block (disk) stats — try common targets
    let (disk_rd_bytes, disk_wr_bytes) = collect_block_stats(domain);

    // Network stats — try common interfaces
    let (net_rx_bytes, net_tx_bytes) = collect_net_stats(domain);

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
    })
}

fn collect_block_stats(domain: &Domain) -> (u64, u64) {
    let targets = ["vda", "vdb", "sda", "sdb", "hda"];
    let mut rd_total: u64 = 0;
    let mut wr_total: u64 = 0;

    for target in &targets {
        if let Ok(stats) = domain.get_block_stats(target) {
            if stats.rd_bytes > 0 {
                rd_total += stats.rd_bytes as u64;
            }
            if stats.wr_bytes > 0 {
                wr_total += stats.wr_bytes as u64;
            }
        }
    }

    (rd_total, wr_total)
}

fn collect_net_stats(domain: &Domain) -> (u64, u64) {
    let ifaces = ["vnet0", "vnet1", "vnet2", "macvtap0"];
    let mut rx_total: u64 = 0;
    let mut tx_total: u64 = 0;

    for iface in &ifaces {
        if let Ok(stats) = domain.interface_stats(iface) {
            if stats.rx_bytes > 0 {
                rx_total += stats.rx_bytes as u64;
            }
            if stats.tx_bytes > 0 {
                tx_total += stats.tx_bytes as u64;
            }
        }
    }

    (rx_total, tx_total)
}
